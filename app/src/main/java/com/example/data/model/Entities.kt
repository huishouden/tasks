package com.example.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(tableName = "shopping_lists")
data class ShoppingListEntity(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val description: String = "",
    val iconKey: String = "grocery", // grocery, pantry, hardware, chores, notes
    val colorHex: Long = 0xFF2D6A4F,
    val isDefault: Boolean = false,
    val sortOrder: Int = 0,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "list_items")
data class ListItemEntity(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),
    val listId: String,
    val name: String,
    val category: String = CategoryConstants.OTHER,
    val quantity: String = "1",
    val notes: String = "",
    val addedBy: String = HouseholdMember.KITCHEN_TABLET,
    val isCompleted: Boolean = false,
    val urgency: String = UrgencyLevel.NORMAL,
    val createdAt: Long = System.currentTimeMillis(),
    val completedAt: Long? = null,
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "item_frequencies")
data class ItemFrequencyEntity(
    @PrimaryKey
    val nameKey: String, // lowercase trimmed, e.g. "whole milk", "eggs"
    val displayName: String,
    val category: String = CategoryConstants.OTHER,
    val defaultUnit: String = "1",
    val timesAdded: Int = 1,
    val timesCompleted: Int = 0,
    val lastAddedAt: Long = System.currentTimeMillis(),
    val lastCompletedAt: Long? = null
)

object HouseholdMember {
    const val KITCHEN_TABLET = "Kitchen Tablet"
    const val HUSBAND = "Husband"
    const val WIFE = "Wife"

    val ALL = listOf(KITCHEN_TABLET, HUSBAND, WIFE)
}

object UrgencyLevel {
    const val URGENT = "Need Today"
    const val NORMAL = "Standard"
    const val WHENEVER = "Whenever"

    val ALL = listOf(NORMAL, URGENT, WHENEVER)
}

object CategoryConstants {
    const val PRODUCE = "Produce & Greens"
    const val DAIRY_EGGS = "Dairy & Eggs"
    const val BAKERY = "Bakery & Bread"
    const val MEAT_SEAFOOD = "Meat & Seafood"
    const val PANTRY = "Pantry & Dry Goods"
    const val FROZEN = "Frozen Foods"
    const val BEVERAGES = "Beverages & Coffee"
    const val SNACKS = "Snacks & Sweets"
    const val HOUSEHOLD = "Household & Cleaning"
    const val PERSONAL_CARE = "Personal Care"
    const val HARDWARE_HOME = "Hardware & Tools"
    const val NOTES_CHORES = "Chores & Tasks"
    const val OTHER = "Other"

    val ALL_CATEGORIES = listOf(
        PRODUCE,
        DAIRY_EGGS,
        BAKERY,
        MEAT_SEAFOOD,
        PANTRY,
        FROZEN,
        BEVERAGES,
        SNACKS,
        HOUSEHOLD,
        PERSONAL_CARE,
        HARDWARE_HOME,
        NOTES_CHORES,
        OTHER
    )

    // Store Aisle shopping order
    val AISLE_ORDER = listOf(
        PRODUCE,
        BAKERY,
        MEAT_SEAFOOD,
        DAIRY_EGGS,
        PANTRY,
        SNACKS,
        BEVERAGES,
        FROZEN,
        HOUSEHOLD,
        PERSONAL_CARE,
        HARDWARE_HOME,
        NOTES_CHORES,
        OTHER
    )
}
