package com.example.data.repository

import com.example.data.db.AppDatabase
import com.example.data.model.CategoryConstants
import com.example.data.model.HouseholdMember
import com.example.data.model.ItemFrequencyEntity
import com.example.data.model.ListItemEntity
import com.example.data.model.ShoppingListEntity
import com.example.data.sync.HouseholdSyncManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import java.util.UUID

class HearthRepository(
    private val database: AppDatabase,
    val syncManager: HouseholdSyncManager
) {
    private val listDao = database.shoppingListDao()
    private val itemDao = database.listItemDao()
    private val freqDao = database.itemFrequencyDao()
    private val repoScope = CoroutineScope(Dispatchers.IO)

    val allLists: Flow<List<ShoppingListEntity>> = listDao.getAllLists()

    fun getItemsForList(listId: String): Flow<List<ListItemEntity>> =
        itemDao.getItemsForList(listId)

    fun getTopFrequentStaples(): Flow<List<ItemFrequencyEntity>> =
        freqDao.getTopFrequentItems(limit = 14)

    fun searchSuggestions(query: String): Flow<List<ItemFrequencyEntity>> =
        freqDao.searchFrequencies(query.trim().lowercase())

    suspend fun insertItem(
        listId: String,
        name: String,
        category: String = CategoryConstants.OTHER,
        quantity: String = "1",
        notes: String = "",
        addedBy: String = syncManager.getActiveMember(),
        urgency: String = "Standard"
    ) {
        val trimmedName = name.trim()
        if (trimmedName.isBlank()) return

        // Auto-detect category if OTHER was passed
        val resolvedCategory = if (category == CategoryConstants.OTHER) {
            guessCategory(trimmedName)
        } else {
            category
        }

        val newItem = ListItemEntity(
            id = UUID.randomUUID().toString(),
            listId = listId,
            name = trimmedName,
            category = resolvedCategory,
            quantity = if (quantity.isBlank()) "1" else quantity.trim(),
            notes = notes.trim(),
            addedBy = addedBy,
            urgency = urgency,
            isCompleted = false,
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis()
        )
        itemDao.insertItem(newItem)

        // Increment frequency tracking
        val nameKey = trimmedName.lowercase()
        val existingFreq = freqDao.getFrequencyByKey(nameKey)
        if (existingFreq != null) {
            val updated = existingFreq.copy(
                timesAdded = existingFreq.timesAdded + 1,
                lastAddedAt = System.currentTimeMillis(),
                category = resolvedCategory
            )
            freqDao.insertFrequency(updated)
        } else {
            val newFreq = ItemFrequencyEntity(
                nameKey = nameKey,
                displayName = trimmedName,
                category = resolvedCategory,
                defaultUnit = quantity,
                timesAdded = 1,
                timesCompleted = 0,
                lastAddedAt = System.currentTimeMillis()
            )
            freqDao.insertFrequency(newFreq)
        }

        // Trigger background sync
        repoScope.launch {
            syncManager.syncNow()
        }
    }

    suspend fun toggleItemCompleted(item: ListItemEntity) {
        val now = System.currentTimeMillis()
        val newStatus = !item.isCompleted
        val updated = item.copy(
            isCompleted = newStatus,
            completedAt = if (newStatus) now else null,
            updatedAt = now
        )
        itemDao.updateItem(updated)

        if (newStatus) {
            val nameKey = item.name.trim().lowercase()
            val existing = freqDao.getFrequencyByKey(nameKey)
            if (existing != null) {
                freqDao.insertFrequency(
                    existing.copy(
                        timesCompleted = existing.timesCompleted + 1,
                        lastCompletedAt = now
                    )
                )
            }
        }

        repoScope.launch {
            syncManager.syncNow()
        }
    }

    suspend fun updateItem(item: ListItemEntity) {
        itemDao.updateItem(item.copy(updatedAt = System.currentTimeMillis()))
        repoScope.launch {
            syncManager.syncNow()
        }
    }

    suspend fun deleteItem(item: ListItemEntity) {
        itemDao.deleteItem(item)
        repoScope.launch {
            syncManager.syncNow()
        }
    }

    suspend fun clearCompletedItems(listId: String) {
        itemDao.clearCompletedItems(listId)
        repoScope.launch {
            syncManager.syncNow()
        }
    }

    suspend fun createNewList(name: String, iconKey: String = "grocery", colorHex: Long = 0xFF2D6A4F) {
        val list = ShoppingListEntity(
            id = "list-" + UUID.randomUUID().toString().take(8),
            name = name.trim(),
            iconKey = iconKey,
            colorHex = colorHex,
            createdAt = System.currentTimeMillis()
        )
        listDao.insertList(list)
    }

    suspend fun deleteList(list: ShoppingListEntity) {
        itemDao.clearAllItemsInList(list.id)
        listDao.deleteList(list)
    }

    companion object {
        /**
         * Smart category guesser based on item name keywords.
         */
        fun guessCategory(itemName: String): String {
            val lower = itemName.lowercase()
            return when {
                lower.contains("milk") || lower.contains("egg") || lower.contains("cheese") ||
                        lower.contains("butter") || lower.contains("yogurt") || lower.contains("cream") ->
                    CategoryConstants.DAIRY_EGGS

                lower.contains("apple") || lower.contains("banana") || lower.contains("berry") ||
                        lower.contains("avocado") || lower.contains("onion") || lower.contains("garlic") ||
                        lower.contains("tomato") || lower.contains("lettuce") || lower.contains("spinach") ||
                        lower.contains("potato") || lower.contains("carrot") || lower.contains("lemon") ||
                        lower.contains("lime") || lower.contains("fruit") || lower.contains("kale") ->
                    CategoryConstants.PRODUCE

                lower.contains("bread") || lower.contains("bagel") || lower.contains("croissant") ||
                        lower.contains("tortilla") || lower.contains("bun") || lower.contains("muffin") ->
                    CategoryConstants.BAKERY

                lower.contains("chicken") || lower.contains("beef") || lower.contains("pork") ||
                        lower.contains("salmon") || lower.contains("fish") || lower.contains("turkey") ||
                        lower.contains("steak") || lower.contains("bacon") || lower.contains("sausage") ->
                    CategoryConstants.MEAT_SEAFOOD

                lower.contains("coffee") || lower.contains("tea") || lower.contains("juice") ||
                        lower.contains("soda") || lower.contains("water") || lower.contains("beer") ||
                        lower.contains("wine") || lower.contains("sparkling") ->
                    CategoryConstants.BEVERAGES

                lower.contains("chip") || lower.contains("cookie") || lower.contains("cracker") ||
                        lower.contains("chocolate") || lower.contains("popcorn") || lower.contains("snack") ||
                        lower.contains("candy") ->
                    CategoryConstants.SNACKS

                lower.contains("frozen") || lower.contains("ice cream") || lower.contains("pizza") ||
                        lower.contains("popsicle") ->
                    CategoryConstants.FROZEN

                lower.contains("paper towel") || lower.contains("toilet paper") || lower.contains("soap") ||
                        lower.contains("detergent") || lower.contains("trash bag") || lower.contains("sponge") ||
                        lower.contains("bleach") || lower.contains("cleaner") ->
                    CategoryConstants.HOUSEHOLD

                lower.contains("shampoo") || lower.contains("toothpaste") || lower.contains("deodorant") ||
                        lower.contains("lotion") || lower.contains("soap") || lower.contains("vitamin") ->
                    CategoryConstants.PERSONAL_CARE

                lower.contains("screw") || lower.contains("nail") || lower.contains("filter") ||
                        lower.contains("battery") || lower.contains("bulb") || lower.contains("tape") ||
                        lower.contains("tool") || lower.contains("drill") ->
                    CategoryConstants.HARDWARE_HOME

                lower.contains("clean") || lower.contains("fix") || lower.contains("call") ||
                        lower.contains("mow") || lower.contains("pay") || lower.contains("check") ->
                    CategoryConstants.NOTES_CHORES

                lower.contains("oil") || lower.contains("rice") || lower.contains("pasta") ||
                        lower.contains("flour") || lower.contains("sugar") || lower.contains("spice") ||
                        lower.contains("salt") || lower.contains("sauce") || lower.contains("cereal") ||
                        lower.contains("oat") || lower.contains("bean") || lower.contains("can") ->
                    CategoryConstants.PANTRY

                else -> CategoryConstants.OTHER
            }
        }
    }
}
