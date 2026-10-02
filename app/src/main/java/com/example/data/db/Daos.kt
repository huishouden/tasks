package com.example.data.db

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.example.data.model.ItemFrequencyEntity
import com.example.data.model.ListItemEntity
import com.example.data.model.ShoppingListEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ShoppingListDao {
    @Query("SELECT * FROM shopping_lists ORDER BY sortOrder ASC, createdAt ASC")
    fun getAllLists(): Flow<List<ShoppingListEntity>>

    @Query("SELECT * FROM shopping_lists WHERE id = :listId LIMIT 1")
    fun getListById(listId: String): Flow<ShoppingListEntity?>

    @Query("SELECT * FROM shopping_lists WHERE id = :listId LIMIT 1")
    suspend fun getListByIdSync(listId: String): ShoppingListEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertList(list: ShoppingListEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLists(lists: List<ShoppingListEntity>)

    @Update
    suspend fun updateList(list: ShoppingListEntity)

    @Delete
    suspend fun deleteList(list: ShoppingListEntity)
}

@Dao
interface ListItemDao {
    @Query("SELECT * FROM list_items WHERE listId = :listId ORDER BY isCompleted ASC, createdAt DESC")
    fun getItemsForList(listId: String): Flow<List<ListItemEntity>>

    @Query("SELECT * FROM list_items ORDER BY createdAt DESC")
    fun getAllItems(): Flow<List<ListItemEntity>>

    @Query("SELECT * FROM list_items WHERE id = :id LIMIT 1")
    suspend fun getItemById(id: String): ListItemEntity?

    @Query("SELECT * FROM list_items")
    suspend fun getAllItemsSync(): List<ListItemEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertItem(item: ListItemEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertItems(items: List<ListItemEntity>)

    @Update
    suspend fun updateItem(item: ListItemEntity)

    @Delete
    suspend fun deleteItem(item: ListItemEntity)

    @Query("DELETE FROM list_items WHERE listId = :listId AND isCompleted = 1")
    suspend fun clearCompletedItems(listId: String)

    @Query("DELETE FROM list_items WHERE listId = :listId")
    suspend fun clearAllItemsInList(listId: String)
}

@Dao
interface ItemFrequencyDao {
    @Query("SELECT * FROM item_frequencies ORDER BY timesAdded DESC, lastAddedAt DESC LIMIT :limit")
    fun getTopFrequentItems(limit: Int = 18): Flow<List<ItemFrequencyEntity>>

    @Query("SELECT * FROM item_frequencies WHERE nameKey LIKE '%' || :query || '%' OR displayName LIKE '%' || :query || '%' ORDER BY timesAdded DESC LIMIT 10")
    fun searchFrequencies(query: String): Flow<List<ItemFrequencyEntity>>

    @Query("SELECT * FROM item_frequencies")
    fun getAllFrequencies(): Flow<List<ItemFrequencyEntity>>

    @Query("SELECT * FROM item_frequencies")
    suspend fun getAllFrequenciesSync(): List<ItemFrequencyEntity>

    @Query("SELECT * FROM item_frequencies WHERE nameKey = :key LIMIT 1")
    suspend fun getFrequencyByKey(key: String): ItemFrequencyEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertFrequency(freq: ItemFrequencyEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertFrequencies(freqs: List<ItemFrequencyEntity>)
}
