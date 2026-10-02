package com.example.ui.screens

import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.Kitchen
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.NoteAlt
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.TabletAndroid
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.model.CategoryConstants
import com.example.data.model.HouseholdMember
import com.example.data.model.ListItemEntity
import com.example.data.model.ShoppingListEntity
import com.example.ui.components.FrequentStaplesShelf
import com.example.ui.components.ItemRow
import com.example.ui.components.SmartAddBar
import com.example.ui.dialogs.AddListDialog
import com.example.ui.dialogs.EditItemDialog
import com.example.ui.dialogs.HouseholdPairingDialog
import com.example.ui.theme.AmberGold
import com.example.ui.theme.ForestPrimary
import com.example.ui.viewmodel.AppMode
import com.example.ui.viewmodel.MainViewModel
import com.example.ui.viewmodel.ThemeMode
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(viewModel: MainViewModel) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    val lists by viewModel.lists.collectAsStateWithLifecycle()
    val selectedListId by viewModel.selectedListId.collectAsStateWithLifecycle()
    val items by viewModel.items.collectAsStateWithLifecycle()
    val frequentStaples by viewModel.frequentStaples.collectAsStateWithLifecycle()
    val suggestions by viewModel.autoSuggestions.collectAsStateWithLifecycle()
    val syncStatus by viewModel.syncStatus.collectAsStateWithLifecycle()
    val appMode by viewModel.appMode.collectAsStateWithLifecycle()
    val searchQuery by viewModel.searchQuery.collectAsStateWithLifecycle()
    val filterCategory by viewModel.filterCategory.collectAsStateWithLifecycle()
    val themeMode by viewModel.themeMode.collectAsStateWithLifecycle()
    val isSystemDark = isSystemInDarkTheme()
    val isDark = when (themeMode) {
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
        ThemeMode.SYSTEM -> isSystemDark
    }

    val currentList = lists.firstOrNull { it.id == selectedListId } ?: lists.firstOrNull()

    // Dialog state
    var showPairingDialog by remember { mutableStateOf(false) }
    var showAddListDialog by remember { mutableStateOf(false) }
    var itemToEdit by remember { mutableStateOf<ListItemEntity?>(null) }

    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)

    // Handle back button for modes
    BackHandler(enabled = appMode != AppMode.NORMAL) {
        viewModel.setAppMode(AppMode.NORMAL)
    }

    // Share shopping list intent helper
    fun shareCurrentList() {
        val listName = currentList?.name ?: "Groceries"
        coroutineScope.launch {
            val text = viewModel.getFormattedListShareText(listName)
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_SUBJECT, "🛒 HearthList: $listName")
                putExtra(Intent.EXTRA_TEXT, text)
            }
            context.startActivity(Intent.createChooser(intent, "Share $listName to…"))
        }
    }

    // Render specialized full-screen views if active
    if (appMode == AppMode.COUNTERTOP_HUB) {
        CountertopHubScreen(
            currentList = currentList,
            items = items,
            staples = frequentStaples,
            householdCode = syncStatus.householdCode,
            onToggleCompleted = { viewModel.toggleItemCompleted(it) },
            onAddItem = { viewModel.addItem(it) },
            onQuickAddStaple = { viewModel.quickAddStaple(it) },
            onSyncNow = { viewModel.syncNow() },
            onExitCountertopMode = { viewModel.setAppMode(AppMode.NORMAL) },
            isDarkTheme = isDark,
            onToggleTheme = { viewModel.toggleTheme() }
        )
        return
    }

    if (appMode == AppMode.IN_STORE_SHOPPING) {
        InStoreShoppingScreen(
            currentList = currentList,
            items = items,
            onToggleCompleted = { viewModel.toggleItemCompleted(it) },
            onClearCompleted = { viewModel.clearCompleted() },
            onExitStoreMode = { viewModel.setAppMode(AppMode.NORMAL) }
        )
        return
    }

    // Main App with Adaptive Design for Tablet & Phone
    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val isWideScreen = maxWidth >= 720.dp

        if (isWideScreen) {
            // TABLET DUAL-PANE CANONICAL LAYOUT
            Row(modifier = Modifier.fillMaxSize()) {
                // Left Navigation & Household Hub Sidebar (280dp)
                Surface(
                    modifier = Modifier
                        .width(300.dp)
                        .fillMaxHeight(),
                    color = MaterialTheme.colorScheme.surface,
                    tonalElevation = 2.dp
                ) {
                    SidebarContent(
                        lists = lists,
                        selectedListId = selectedListId,
                        onSelectList = { viewModel.selectList(it) },
                        onOpenAddList = { showAddListDialog = true },
                        syncStatus = syncStatus,
                        onOpenPairing = { showPairingDialog = true },
                        onSyncNow = { viewModel.syncNow() },
                        onSwitchMode = { viewModel.setAppMode(it) },
                        onSwitchMember = { viewModel.switchActiveMember(it) },
                        themeMode = themeMode,
                        onSetThemeMode = { viewModel.setThemeMode(it) }
                    )
                }

                // Right Detail Pane
                Surface(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    ListDetailContent(
                        currentList = currentList,
                        items = items,
                        frequentStaples = frequentStaples,
                        suggestions = suggestions,
                        searchQuery = searchQuery,
                        filterCategory = filterCategory,
                        syncStatus = syncStatus,
                        isWideScreen = true,
                        isDarkTheme = isDark,
                        onToggleTheme = { viewModel.toggleTheme() },
                        onSearchChange = { viewModel.setSearchQuery(it) },
                        onFilterCategoryChange = { viewModel.setFilterCategory(it) },
                        onAddItem = { name, cat, qty, notes, urgency ->
                            viewModel.addItem(name, cat, qty, notes, urgency)
                        },
                        onQuickAddStaple = { viewModel.quickAddStaple(it) },
                        onToggleCompleted = { viewModel.toggleItemCompleted(it) },
                        onEditItem = { itemToEdit = it },
                        onDeleteItem = { viewModel.deleteItem(it) },
                        onClearCompleted = { viewModel.clearCompleted() },
                        onShareList = { shareCurrentList() },
                        onOpenStoreMode = { viewModel.setAppMode(AppMode.IN_STORE_SHOPPING) },
                        onOpenCountertopMode = { viewModel.setAppMode(AppMode.COUNTERTOP_HUB) },
                        onOpenNav = {}
                    )
                }
            }
        } else {
            // PHONE COMPACT SINGLE-PANE LAYOUT WITH DRAWER
            ModalNavigationDrawer(
                drawerState = drawerState,
                drawerContent = {
                    ModalDrawerSheet(modifier = Modifier.width(300.dp)) {
                        SidebarContent(
                            lists = lists,
                            selectedListId = selectedListId,
                            onSelectList = {
                                viewModel.selectList(it)
                                coroutineScope.launch { drawerState.close() }
                            },
                            onOpenAddList = {
                                showAddListDialog = true
                                coroutineScope.launch { drawerState.close() }
                            },
                            syncStatus = syncStatus,
                            onOpenPairing = {
                                showPairingDialog = true
                                coroutineScope.launch { drawerState.close() }
                            },
                            onSyncNow = { viewModel.syncNow() },
                            onSwitchMode = {
                                viewModel.setAppMode(it)
                                coroutineScope.launch { drawerState.close() }
                            },
                            onSwitchMember = { viewModel.switchActiveMember(it) },
                            themeMode = themeMode,
                            onSetThemeMode = { viewModel.setThemeMode(it) }
                        )
                    }
                }
            ) {
                Scaffold(
                    topBar = {
                        TopAppBar(
                            title = {
                                Text(
                                    text = currentList?.name ?: "Groceries",
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.Bold
                                )
                            },
                            navigationIcon = {
                                IconButton(onClick = { coroutineScope.launch { drawerState.open() } }) {
                                    Icon(imageVector = Icons.Default.Menu, contentDescription = "Menu")
                                }
                            },
                            actions = {
                                IconButton(onClick = { viewModel.toggleTheme() }) {
                                    Icon(
                                        imageVector = if (isDark) Icons.Default.LightMode else Icons.Default.DarkMode,
                                        contentDescription = if (isDark) "Switch to Light Mode" else "Switch to Dark Mode",
                                        tint = ForestPrimary
                                    )
                                }
                                IconButton(onClick = { viewModel.setAppMode(AppMode.IN_STORE_SHOPPING) }) {
                                    Icon(
                                        imageVector = Icons.Default.Storefront,
                                        contentDescription = "In-Store Shopping Mode",
                                        tint = ForestPrimary
                                    )
                                }
                                IconButton(onClick = { shareCurrentList() }) {
                                    Icon(imageVector = Icons.Default.Share, contentDescription = "Share List")
                                }
                            },
                            colors = TopAppBarDefaults.topAppBarColors(
                                containerColor = MaterialTheme.colorScheme.surface
                            )
                        )
                    },
                    containerColor = MaterialTheme.colorScheme.background
                ) { innerPadding ->
                    Box(modifier = Modifier.padding(innerPadding)) {
                        ListDetailContent(
                            currentList = currentList,
                            items = items,
                            frequentStaples = frequentStaples,
                            suggestions = suggestions,
                            searchQuery = searchQuery,
                            filterCategory = filterCategory,
                            syncStatus = syncStatus,
                            isWideScreen = false,
                            isDarkTheme = isDark,
                            onToggleTheme = { viewModel.toggleTheme() },
                            onSearchChange = { viewModel.setSearchQuery(it) },
                            onFilterCategoryChange = { viewModel.setFilterCategory(it) },
                            onAddItem = { name, cat, qty, notes, urgency ->
                                viewModel.addItem(name, cat, qty, notes, urgency)
                            },
                            onQuickAddStaple = { viewModel.quickAddStaple(it) },
                            onToggleCompleted = { viewModel.toggleItemCompleted(it) },
                            onEditItem = { itemToEdit = it },
                            onDeleteItem = { viewModel.deleteItem(it) },
                            onClearCompleted = { viewModel.clearCompleted() },
                            onShareList = { shareCurrentList() },
                            onOpenStoreMode = { viewModel.setAppMode(AppMode.IN_STORE_SHOPPING) },
                            onOpenCountertopMode = { viewModel.setAppMode(AppMode.COUNTERTOP_HUB) },
                            onOpenNav = { coroutineScope.launch { drawerState.open() } }
                        )
                    }
                }
            }
        }
    }

    // Dialogs
    if (showPairingDialog) {
        HouseholdPairingDialog(
            syncStatus = syncStatus,
            onDismiss = { showPairingDialog = false },
            onSyncNow = { viewModel.syncNow() },
            onUpdateHouseholdCode = { viewModel.setHouseholdCode(it) },
            onSelectMember = { viewModel.switchActiveMember(it) },
            onShareListFormatted = { shareCurrentList() }
        )
    }

    if (showAddListDialog) {
        AddListDialog(
            onDismiss = { showAddListDialog = false },
            onCreate = { name, icon, color ->
                viewModel.createNewList(name, icon, color)
                showAddListDialog = false
            }
        )
    }

    itemToEdit?.let { item ->
        EditItemDialog(
            item = item,
            onDismiss = { itemToEdit = null },
            onSave = { updated ->
                viewModel.updateItem(updated)
                itemToEdit = null
            }
        )
    }
}

/**
 * Sidebar Navigation Content: Lists, Household Sync Info, Mode Switches
 */
@Composable
fun SidebarContent(
    lists: List<ShoppingListEntity>,
    selectedListId: String?,
    onSelectList: (String) -> Unit,
    onOpenAddList: () -> Unit,
    syncStatus: com.example.data.sync.SyncStatus,
    onOpenPairing: () -> Unit,
    onSyncNow: () -> Unit,
    onSwitchMode: (AppMode) -> Unit,
    onSwitchMember: (String) -> Unit,
    themeMode: ThemeMode = ThemeMode.LIGHT,
    onSetThemeMode: (ThemeMode) -> Unit = {}
) {
    val infiniteTransition = rememberInfiniteTransition(label = "syncSpin")
    val rotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(animation = tween(1000, easing = LinearEasing), repeatMode = RepeatMode.Restart),
        label = "rot"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Column {
            // App Branding & Household Code Pill
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(ForestPrimary),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Kitchen,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "HearthList",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Black,
                            color = ForestPrimary
                        )
                        Text(
                            text = "Household Hub",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                IconButton(onClick = onSyncNow) {
                    Icon(
                        imageVector = Icons.Default.Sync,
                        contentDescription = "Sync",
                        tint = ForestPrimary,
                        modifier = Modifier.then(if (syncStatus.isSyncing) Modifier.rotate(rotation) else Modifier)
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Household Sync Card (Tap to open pairing dialog)
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .clickable { onOpenPairing() },
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.CloudSync,
                                contentDescription = null,
                                tint = ForestPrimary,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "HOUSEHOLD SYNC",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                        }

                        Icon(
                            imageVector = Icons.Default.QrCode,
                            contentDescription = "QR Pairing",
                            tint = ForestPrimary,
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = syncStatus.householdCode,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Text(
                        text = "Active on device: ${syncStatus.activeMember}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Specialized Modes Section
            Text(
                text = "SPECIALIZED MODES",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))

            // Countertop Kitchen Kiosk Mode button
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .clickable { onSwitchMode(AppMode.COUNTERTOP_HUB) }
                    .testTag("mode_countertop_button"),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f))
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.TabletAndroid,
                        contentDescription = null,
                        tint = AmberGold,
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "Countertop Hub Display",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Always-on kitchen kiosk mode",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // In-Store Shopping Mode button
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .clickable { onSwitchMode(AppMode.IN_STORE_SHOPPING) }
                    .testTag("mode_store_button"),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f))
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Storefront,
                        contentDescription = null,
                        tint = ForestPrimary,
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "In-Store Shopping Mode",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Aisle sequence & fast checklist",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Household Lists
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "MY LISTS",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                IconButton(onClick = onOpenAddList, modifier = Modifier.size(28.dp)) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "New List",
                        tint = ForestPrimary,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            lists.forEach { list ->
                val isSelected = list.id == selectedListId
                val listIcon = when (list.iconKey) {
                    "pantry" -> Icons.Default.Kitchen
                    "hardware" -> Icons.Default.Build
                    "chores" -> Icons.Default.Checklist
                    "notes" -> Icons.Default.NoteAlt
                    else -> Icons.Default.ShoppingCart
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(
                            if (isSelected) MaterialTheme.colorScheme.primaryContainer else Color.Transparent
                        )
                        .clickable { onSelectList(list.id) }
                        .padding(horizontal = 12.dp, vertical = 10.dp)
                        .testTag("list_tab_${list.id}"),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = listIcon,
                            contentDescription = null,
                            tint = if (isSelected) ForestPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = list.name,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            }
        }

        // Appearance / Theme Mode Selector in Sidebar
        Column(modifier = Modifier.padding(top = 16.dp)) {
            Text(
                text = "APPEARANCE:",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                FilterChip(
                    selected = themeMode == ThemeMode.LIGHT,
                    onClick = { onSetThemeMode(ThemeMode.LIGHT) },
                    label = {
                        Text(
                            text = "☀️ Light",
                            style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp)
                        )
                    }
                )
                FilterChip(
                    selected = themeMode == ThemeMode.DARK,
                    onClick = { onSetThemeMode(ThemeMode.DARK) },
                    label = {
                        Text(
                            text = "🌙 Dark",
                            style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp)
                        )
                    }
                )
                FilterChip(
                    selected = themeMode == ThemeMode.SYSTEM,
                    onClick = { onSetThemeMode(ThemeMode.SYSTEM) },
                    label = {
                        Text(
                            text = "⚙️ Auto",
                            style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp)
                        )
                    }
                )
            }
        }

        // Active Profile Selector in Footer
        Column(modifier = Modifier.padding(top = 16.dp)) {
            Text(
                text = "ADDING ITEMS AS:",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                HouseholdMember.ALL.forEach { member ->
                    val isSelected = member == syncStatus.activeMember
                    FilterChip(
                        selected = isSelected,
                        onClick = { onSwitchMember(member) },
                        label = {
                            Text(
                                text = member.replace("Kitchen Tablet", "Tablet"),
                                style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp)
                            )
                        }
                    )
                }
            }
        }
    }
}

/**
 * Main Detail Content: Search, Smart Staples, Smart Add, List Items grouped by category
 */
@Composable
fun ListDetailContent(
    currentList: ShoppingListEntity?,
    items: List<ListItemEntity>,
    frequentStaples: List<com.example.data.model.ItemFrequencyEntity>,
    suggestions: List<com.example.data.model.ItemFrequencyEntity>,
    searchQuery: String,
    filterCategory: String?,
    syncStatus: com.example.data.sync.SyncStatus,
    isWideScreen: Boolean,
    onSearchChange: (String) -> Unit,
    onFilterCategoryChange: (String?) -> Unit,
    onAddItem: (name: String, cat: String, qty: String, notes: String, urgency: String) -> Unit,
    onQuickAddStaple: (com.example.data.model.ItemFrequencyEntity) -> Unit,
    onToggleCompleted: (ListItemEntity) -> Unit,
    onEditItem: (ListItemEntity) -> Unit,
    onDeleteItem: (ListItemEntity) -> Unit,
    onClearCompleted: () -> Unit,
    onShareList: () -> Unit,
    onOpenStoreMode: () -> Unit,
    onOpenCountertopMode: () -> Unit,
    onOpenNav: () -> Unit,
    isDarkTheme: Boolean = false,
    onToggleTheme: () -> Unit = {}
) {
    val uncompletedItems = items.filter { !it.isCompleted }
    val completedItems = items.filter { it.isCompleted }

    // Group active items by category
    val groupedActive = uncompletedItems.groupBy { it.category }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = if (isWideScreen) 28.dp else 16.dp, vertical = 12.dp)
    ) {
        // Wide Screen Header Actions Bar
        if (isWideScreen) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = currentList?.name ?: "Groceries",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "${uncompletedItems.size} pending items • ${completedItems.size} completed",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = onOpenCountertopMode,
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(imageVector = Icons.Default.TabletAndroid, contentDescription = null, tint = AmberGold, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Countertop Mode", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }

                    Button(
                        onClick = onOpenStoreMode,
                        colors = ButtonDefaults.buttonColors(containerColor = ForestPrimary),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(imageVector = Icons.Default.Storefront, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("In-Store Mode")
                    }

                    IconButton(
                        onClick = onToggleTheme,
                        modifier = Modifier.testTag("theme_toggle_header_wide")
                    ) {
                        Icon(
                            imageVector = if (isDarkTheme) Icons.Default.LightMode else Icons.Default.DarkMode,
                            contentDescription = if (isDarkTheme) "Switch to Light Mode" else "Switch to Dark Mode",
                            tint = ForestPrimary
                        )
                    }

                    IconButton(onClick = onShareList) {
                        Icon(imageVector = Icons.Default.Share, contentDescription = "Share", tint = ForestPrimary)
                    }
                }
            }
        }

        // Search Bar with Clear
        OutlinedTextField(
            value = searchQuery,
            onValueChange = onSearchChange,
            modifier = Modifier
                .fillMaxWidth()
                .testTag("search_field"),
            placeholder = { Text("Search items, notes, or members…", style = MaterialTheme.typography.bodyMedium) },
            leadingIcon = {
                Icon(imageVector = Icons.Default.Search, contentDescription = "Search", tint = MaterialTheme.colorScheme.outline)
            },
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = { onSearchChange("") }) {
                        Icon(imageVector = Icons.Default.Clear, contentDescription = "Clear")
                    }
                }
            },
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            colors = TextFieldDefaults.colors(
                focusedContainerColor = MaterialTheme.colorScheme.surface,
                unfocusedContainerColor = MaterialTheme.colorScheme.surface
            )
        )

        Spacer(modifier = Modifier.height(10.dp))

        // Smart Frequent Staples Shelf ("Smart Restock")
        FrequentStaplesShelf(
            staples = frequentStaples,
            onQuickAdd = onQuickAddStaple
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Smart Add Bar with Real-time autocomplete suggestions
        SmartAddBar(
            onAddItem = onAddItem,
            suggestions = suggestions,
            activeMember = syncStatus.activeMember
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Category Filter Chips
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            FilterChip(
                selected = filterCategory == null,
                onClick = { onFilterCategoryChange(null) },
                label = { Text("All (${items.size})", style = MaterialTheme.typography.labelSmall) }
            )

            CategoryConstants.ALL_CATEGORIES.forEach { category ->
                val count = items.count { it.category == category }
                if (count > 0) {
                    FilterChip(
                        selected = filterCategory == category,
                        onClick = {
                            onFilterCategoryChange(if (filterCategory == category) null else category)
                        },
                        label = { Text("$category ($count)", style = MaterialTheme.typography.labelSmall) }
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Items List
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(bottom = 32.dp)
        ) {
            if (uncompletedItems.isEmpty() && completedItems.isEmpty()) {
                item {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 24.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Default.ShoppingCart,
                                contentDescription = null,
                                tint = ForestPrimary,
                                modifier = Modifier.size(48.dp)
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = "No items in this list yet",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Type above or tap any staple chip to add items.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            } else {
                // Grouped Active Items
                groupedActive.forEach { (category, catItems) ->
                    item(key = "cat_header_$category") {
                        Text(
                            text = category.uppercase(),
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(top = 10.dp, bottom = 2.dp)
                        )
                    }

                    items(catItems, key = { it.id }) { item ->
                        ItemRow(
                            item = item,
                            onToggleCompleted = { onToggleCompleted(item) },
                            onEdit = { onEditItem(item) },
                            onDelete = { onDeleteItem(item) }
                        )
                    }
                }

                // Completed items section with Clear action
                if (completedItems.isNotEmpty()) {
                    item(key = "completed_header") {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 16.dp, bottom = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "COMPLETED (${completedItems.size})",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )

                            TextButton(onClick = onClearCompleted) {
                                Icon(imageVector = Icons.Default.DeleteSweep, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Clear Completed", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }

                    items(completedItems, key = { it.id }) { item ->
                        ItemRow(
                            item = item,
                            onToggleCompleted = { onToggleCompleted(item) },
                            onEdit = { onEditItem(item) },
                            onDelete = { onDeleteItem(item) }
                        )
                    }
                }
            }
        }
    }
}
