package com.example.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.CategoryConstants
import com.example.data.model.ItemFrequencyEntity
import com.example.data.model.UrgencyLevel
import com.example.ui.theme.AmberGold
import com.example.ui.theme.ForestPrimary
import com.example.ui.theme.UrgentRed

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SmartAddBar(
    onAddItem: (name: String, category: String, quantity: String, notes: String, urgency: String) -> Unit,
    suggestions: List<ItemFrequencyEntity>,
    modifier: Modifier = Modifier,
    activeMember: String = "Kitchen Tablet"
) {
    var textInput by remember { mutableStateOf("") }
    var quantityInput by remember { mutableStateOf("1") }
    var notesInput by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf(CategoryConstants.OTHER) }
    var urgencyInput by remember { mutableStateOf(UrgencyLevel.NORMAL) }
    var isExpandedDetails by remember { mutableStateOf(false) }
    var showCategoryDropdown by remember { mutableStateOf(false) }

    fun submit() {
        if (textInput.isNotBlank()) {
            onAddItem(textInput, selectedCategory, quantityInput, notesInput, urgencyInput)
            textInput = ""
            quantityInput = "1"
            notesInput = ""
            selectedCategory = CategoryConstants.OTHER
            urgencyInput = UrgencyLevel.NORMAL
            isExpandedDetails = false
        }
    }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .testTag("smart_add_card"),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Main Input Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = textInput,
                    onValueChange = { newText ->
                        textInput = newText
                    },
                    modifier = Modifier
                        .weight(1f)
                        .testTag("add_item_input"),
                    placeholder = {
                        Text(
                            text = "Add grocery or note (e.g. Milk, Eggs, Light bulbs)…",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                        )
                    },
                    shape = RoundedCornerShape(14.dp),
                    singleLine = true,
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                        unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.25f),
                        focusedIndicatorColor = ForestPrimary,
                        unfocusedIndicatorColor = Color.Transparent
                    )
                )

                Spacer(modifier = Modifier.width(10.dp))

                // Submit Button
                Button(
                    onClick = { submit() },
                    modifier = Modifier
                        .height(52.dp)
                        .testTag("add_item_submit_button"),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = ForestPrimary),
                    enabled = textInput.isNotBlank()
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Add Item",
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add", fontWeight = FontWeight.Bold)
                }
            }

            // Real-Time Predictive Autocomplete Suggestions
            if (suggestions.isNotEmpty() && textInput.isNotBlank()) {
                Spacer(modifier = Modifier.height(10.dp))
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                        .padding(8.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(bottom = 6.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.AutoAwesome,
                            contentDescription = null,
                            tint = AmberGold,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Smart Suggestions (from household history)",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontWeight = FontWeight.SemiBold
                        )
                    }

                    suggestions.take(3).forEach { suggestion ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .clickable {
                                    textInput = suggestion.displayName
                                    selectedCategory = suggestion.category
                                    quantityInput = suggestion.defaultUnit
                                }
                                .padding(horizontal = 8.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text(
                                    text = suggestion.displayName,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Medium
                                )
                                Text(
                                    text = "${suggestion.category} • Default: ${suggestion.defaultUnit}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.secondary
                                )
                            }

                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = MaterialTheme.colorScheme.primaryContainer
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.LocalFireDepartment,
                                        contentDescription = null,
                                        tint = AmberGold,
                                        modifier = Modifier.size(12.dp)
                                    )
                                    Spacer(modifier = Modifier.width(2.dp))
                                    Text(
                                        text = "${suggestion.timesAdded}x",
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onPrimaryContainer
                                    )
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Quick Preset Quantity Chips & Detail Toggle Row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    text = "Qty:",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                listOf("1", "2", "3", "1 gal", "1 lb", "1 pk", "1 box").forEach { qty ->
                    FilterChip(
                        selected = quantityInput == qty,
                        onClick = { quantityInput = qty },
                        label = { Text(qty, style = MaterialTheme.typography.labelSmall) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                            selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    )
                }

                Spacer(modifier = Modifier.width(6.dp))

                // Urgency quick toggle
                FilterChip(
                    selected = urgencyInput == UrgencyLevel.URGENT,
                    onClick = {
                        urgencyInput = if (urgencyInput == UrgencyLevel.URGENT) UrgencyLevel.NORMAL else UrgencyLevel.URGENT
                    },
                    label = {
                        Text(
                            "⚡ Need Today",
                            style = MaterialTheme.typography.labelSmall,
                            color = if (urgencyInput == UrgencyLevel.URGENT) UrgentRed else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                )

                // Expand more options button (category, notes)
                IconButton(
                    onClick = { isExpandedDetails = !isExpandedDetails },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = if (isExpandedDetails) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        contentDescription = "More details",
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }

            // Expandable extra details (Category & Notes)
            AnimatedVisibility(visible = isExpandedDetails) {
                Column(modifier = Modifier.padding(top = 10.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Category Picker Button
                        Box {
                            Button(
                                onClick = { showCategoryDropdown = true },
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Text(
                                    text = "Aisle: $selectedCategory",
                                    color = MaterialTheme.colorScheme.onSecondaryContainer,
                                    style = MaterialTheme.typography.labelMedium
                                )
                            }

                            DropdownMenu(
                                expanded = showCategoryDropdown,
                                onDismissRequest = { showCategoryDropdown = false },
                                modifier = Modifier.heightIn(max = 300.dp)
                            ) {
                                CategoryConstants.ALL_CATEGORIES.forEach { category ->
                                    DropdownMenuItem(
                                        text = { Text(category) },
                                        onClick = {
                                            selectedCategory = category
                                            showCategoryDropdown = false
                                        }
                                    )
                                }
                            }
                        }

                        // Notes input
                        OutlinedTextField(
                            value = notesInput,
                            onValueChange = { notesInput = it },
                            modifier = Modifier.weight(1f),
                            placeholder = { Text("Brand/notes (e.g. Organic, 2% only)", style = MaterialTheme.typography.bodySmall) },
                            singleLine = true,
                            shape = RoundedCornerShape(10.dp)
                        )
                    }
                }
            }
        }
    }
}
