package com.example.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.db.AppDatabase
import com.example.data.model.CategoryConstants
import com.example.data.model.HouseholdMember
import com.example.data.model.ItemFrequencyEntity
import com.example.data.model.ListItemEntity
import com.example.data.model.ShoppingListEntity
import com.example.data.repository.HearthRepository
import com.example.data.sync.HouseholdSyncManager
import com.example.data.sync.SyncStatus
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

enum class AppMode {
    NORMAL,
    COUNTERTOP_HUB,
    IN_STORE_SHOPPING
}

enum class ThemeMode {
    LIGHT,
    DARK,
    SYSTEM
}

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val database = AppDatabase.getInstance(application)
    private val syncManager = HouseholdSyncManager(application, database)
    val repository = HearthRepository(database, syncManager)

    private val themePrefs = application.getSharedPreferences("hearth_theme_prefs", android.content.Context.MODE_PRIVATE)
    private val _themeMode = MutableStateFlow(
        when (themePrefs.getString("theme_mode", "LIGHT")) {
            "DARK" -> ThemeMode.DARK
            "SYSTEM" -> ThemeMode.SYSTEM
            else -> ThemeMode.LIGHT
        }
    )
    val themeMode: StateFlow<ThemeMode> = _themeMode.asStateFlow()

    fun setThemeMode(mode: ThemeMode) {
        _themeMode.value = mode
        themePrefs.edit().putString("theme_mode", mode.name).apply()
    }

    fun toggleTheme() {
        val next = when (_themeMode.value) {
            ThemeMode.LIGHT -> ThemeMode.DARK
            ThemeMode.DARK -> ThemeMode.LIGHT
            ThemeMode.SYSTEM -> ThemeMode.DARK
        }
        setThemeMode(next)
    }

    val lists: StateFlow<List<ShoppingListEntity>> = repository.allLists
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _selectedListId = MutableStateFlow<String?>(null)
    val selectedListId = _selectedListId.asStateFlow()

    private val _appMode = MutableStateFlow(AppMode.NORMAL)
    val appMode: StateFlow<AppMode> = _appMode.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _filterCategory = MutableStateFlow<String?>(null)
    val filterCategory: StateFlow<String?> = _filterCategory.asStateFlow()

    val syncStatus: StateFlow<SyncStatus> = syncManager.syncStatus

    val frequentStaples: StateFlow<List<ItemFrequencyEntity>> = repository.getTopFrequentStaples()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    @OptIn(ExperimentalCoroutinesApi::class)
    val autoSuggestions: StateFlow<List<ItemFrequencyEntity>> = _searchQuery
        .flatMapLatest { query ->
            if (query.trim().length >= 2) {
                repository.searchSuggestions(query)
            } else {
                flowOf(emptyList())
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    @OptIn(ExperimentalCoroutinesApi::class)
    private val rawItems: StateFlow<List<ListItemEntity>> = _selectedListId
        .flatMapLatest { listId ->
            if (listId != null) {
                repository.getItemsForList(listId)
            } else {
                flowOf(emptyList())
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val items: StateFlow<List<ListItemEntity>> = combine(
        rawItems,
        _searchQuery,
        _filterCategory
    ) { itemsList, query, catFilter ->
        var filtered = itemsList
        if (query.isNotBlank()) {
            val q = query.trim().lowercase()
            filtered = filtered.filter {
                it.name.lowercase().contains(q) ||
                        it.notes.lowercase().contains(q) ||
                        it.category.lowercase().contains(q) ||
                        it.addedBy.lowercase().contains(q)
            }
        }
        if (catFilter != null) {
            filtered = filtered.filter { it.category == catFilter }
        }
        filtered
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init {
        // Automatically select the default or first list once available
        viewModelScope.launch {
            lists.collect { listCollection ->
                if (_selectedListId.value == null && listCollection.isNotEmpty()) {
                    val defaultList = listCollection.firstOrNull { it.isDefault } ?: listCollection.first()
                    _selectedListId.value = defaultList.id
                }
            }
        }
    }

    fun selectList(listId: String) {
        _selectedListId.value = listId
    }

    fun setAppMode(mode: AppMode) {
        _appMode.value = mode
    }

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun setFilterCategory(category: String?) {
        _filterCategory.value = category
    }

    fun switchActiveMember(member: String) {
        syncManager.setActiveMember(member)
    }

    fun syncNow() {
        viewModelScope.launch {
            syncManager.syncNow()
        }
    }

    fun setHouseholdCode(code: String) {
        syncManager.setHouseholdCode(code)
    }

    fun addItem(
        name: String,
        category: String = CategoryConstants.OTHER,
        quantity: String = "1",
        notes: String = "",
        urgency: String = "Standard"
    ) {
        val listId = _selectedListId.value ?: return
        viewModelScope.launch {
            repository.insertItem(
                listId = listId,
                name = name,
                category = category,
                quantity = quantity,
                notes = notes,
                addedBy = syncManager.getActiveMember(),
                urgency = urgency
            )
        }
    }

    fun quickAddStaple(staple: ItemFrequencyEntity) {
        val listId = _selectedListId.value ?: return
        viewModelScope.launch {
            repository.insertItem(
                listId = listId,
                name = staple.displayName,
                category = staple.category,
                quantity = staple.defaultUnit,
                notes = "",
                addedBy = syncManager.getActiveMember(),
                urgency = "Standard"
            )
        }
    }

    fun toggleItemCompleted(item: ListItemEntity) {
        viewModelScope.launch {
            repository.toggleItemCompleted(item)
        }
    }

    fun updateItem(item: ListItemEntity) {
        viewModelScope.launch {
            repository.updateItem(item)
        }
    }

    fun deleteItem(item: ListItemEntity) {
        viewModelScope.launch {
            repository.deleteItem(item)
        }
    }

    fun clearCompleted() {
        val listId = _selectedListId.value ?: return
        viewModelScope.launch {
            repository.clearCompletedItems(listId)
        }
    }

    fun createNewList(name: String, iconKey: String = "grocery", colorHex: Long = 0xFF2D6A4F) {
        viewModelScope.launch {
            repository.createNewList(name, iconKey, colorHex)
        }
    }

    fun deleteList(list: ShoppingListEntity) {
        viewModelScope.launch {
            repository.deleteList(list)
            if (_selectedListId.value == list.id) {
                _selectedListId.value = lists.value.firstOrNull { it.id != list.id }?.id
            }
        }
    }

    suspend fun getFormattedListShareText(listName: String): String {
        val listId = _selectedListId.value ?: return ""
        return syncManager.formatListForSharing(listName, listId)
    }
}
