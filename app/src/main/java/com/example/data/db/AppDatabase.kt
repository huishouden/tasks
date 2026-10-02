package com.example.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import com.example.data.model.ItemFrequencyEntity
import com.example.data.model.ListItemEntity
import com.example.data.model.ShoppingListEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@Database(
    entities = [
        ShoppingListEntity::class,
        ListItemEntity::class,
        ItemFrequencyEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun shoppingListDao(): ShoppingListDao
    abstract fun listItemDao(): ListItemDao
    abstract fun itemFrequencyDao(): ItemFrequencyDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "hearth_hub_database"
                )
                    .addCallback(DatabaseCallback(context.applicationContext))
                    .build()
                INSTANCE = instance
                instance
            }
        }

        private class DatabaseCallback(private val context: Context) : RoomDatabase.Callback() {
            override fun onCreate(db: SupportSQLiteDatabase) {
                super.onCreate(db)
                CoroutineScope(Dispatchers.IO).launch {
                    INSTANCE?.let { database ->
                        seedInitialData(database)
                    }
                }
            }

            override fun onOpen(db: SupportSQLiteDatabase) {
                super.onOpen(db)
                // Automatically purge any sample data left over from prior test installs
                CoroutineScope(Dispatchers.IO).launch {
                    INSTANCE?.let { database ->
                        cleanupOldSampleData(database, context)
                    }
                }
            }
        }

        /**
         * Cleans up any mock/sample items that were seeded in earlier development builds,
         * so the user's tablet starts 100% clean with zero fake data.
         */
        suspend fun cleanupOldSampleData(database: AppDatabase, context: Context) {
            val prefs = context.getSharedPreferences("hearth_cleanup_prefs", Context.MODE_PRIVATE)
            if (!prefs.getBoolean("sample_data_purged_v2", false)) {
                val itemDao = database.listItemDao()
                val sampleNames = setOf(
                    "Whole Milk",
                    "Pasture-Raised Eggs",
                    "Bananas",
                    "Sourdough Bread",
                    "Cold Brew Coffee",
                    "Avocados"
                )
                val allItems = itemDao.getAllItemsSync()
                for (item in allItems) {
                    if (sampleNames.contains(item.name)) {
                        itemDao.deleteItem(item)
                    }
                }
                prefs.edit().putBoolean("sample_data_purged_v2", true).apply()
            }
        }

        /**
         * Seeds only the 5 clean household lists (Groceries, Pantry, Costco, Hardware, Notes)
         * without any fake grocery items or fake history.
         */
        suspend fun seedInitialData(database: AppDatabase) {
            val listDao = database.shoppingListDao()

            val groceryListId = "list-groceries-default"
            val pantryListId = "list-pantry-default"
            val costcoListId = "list-costco-default"
            val hardwareListId = "list-hardware-default"
            val notesListId = "list-notes-default"

            val defaultLists = listOf(
                ShoppingListEntity(
                    id = groceryListId,
                    name = "Groceries",
                    description = "Weekly supermarket & fresh market run",
                    iconKey = "grocery",
                    colorHex = 0xFF2D6A4F,
                    isDefault = true,
                    sortOrder = 0
                ),
                ShoppingListEntity(
                    id = pantryListId,
                    name = "Pantry Restock",
                    description = "Dry goods, spices, and kitchen essentials",
                    iconKey = "pantry",
                    colorHex = 0xFFB07D3E,
                    isDefault = false,
                    sortOrder = 1
                ),
                ShoppingListEntity(
                    id = costcoListId,
                    name = "Costco & Bulk",
                    description = "Paper goods, snacks, and bulk club supplies",
                    iconKey = "bulk",
                    colorHex = 0xFF1E56A0,
                    isDefault = false,
                    sortOrder = 2
                ),
                ShoppingListEntity(
                    id = hardwareListId,
                    name = "Hardware & Home",
                    description = "Home repairs, tools, filters, garden",
                    iconKey = "hardware",
                    colorHex = 0xFFD97706,
                    isDefault = false,
                    sortOrder = 3
                ),
                ShoppingListEntity(
                    id = notesListId,
                    name = "Household Chores & Notes",
                    description = "Family reminders, repairs, and weekend to-dos",
                    iconKey = "notes",
                    colorHex = 0xFF7C3AED,
                    isDefault = false,
                    sortOrder = 4
                )
            )
            listDao.insertLists(defaultLists)
        }
    }
}
