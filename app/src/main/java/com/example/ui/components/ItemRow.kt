package com.example.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.PriorityHigh
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.TabletAndroid
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.HouseholdMember
import com.example.data.model.ListItemEntity
import com.example.data.model.UrgencyLevel
import com.example.ui.theme.ForestPrimary
import com.example.ui.theme.UrgentRed
import com.example.ui.theme.UrgentRedBg

@Composable
fun ItemRow(
    item: ListItemEntity,
    onToggleCompleted: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier,
    isLargeTouchTarget: Boolean = false
) {
    val cardBg by animateColorAsState(
        targetValue = if (item.isCompleted) {
            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        } else {
            MaterialTheme.colorScheme.surface
        },
        animationSpec = tween(200),
        label = "cardBg"
    )

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .clickable { onToggleCompleted() }
            .testTag("item_row_${item.id}"),
        colors = CardDefaults.cardColors(containerColor = cardBg),
        elevation = CardDefaults.cardElevation(defaultElevation = if (item.isCompleted) 0.dp else 1.5.dp),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(
                    horizontal = if (isLargeTouchTarget) 20.dp else 16.dp,
                    vertical = if (isLargeTouchTarget) 18.dp else 12.dp
                ),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Checkbox Circle (Extra large if in tablet countertop mode)
            val checkboxSize = if (isLargeTouchTarget) 36.dp else 28.dp
            Box(
                modifier = Modifier
                    .size(checkboxSize)
                    .clip(CircleShape)
                    .background(
                        if (item.isCompleted) ForestPrimary else MaterialTheme.colorScheme.surfaceVariant
                    )
                    .testTag("checkbox_${item.id}"),
                contentAlignment = Alignment.Center
            ) {
                if (item.isCompleted) {
                    Icon(
                        imageVector = Icons.Default.Check,
                        contentDescription = "Completed",
                        tint = Color.White,
                        modifier = Modifier.size(if (isLargeTouchTarget) 24.dp else 18.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.width(16.dp))

            // Main Text Info
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.Center
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = item.name,
                        style = if (isLargeTouchTarget) {
                            MaterialTheme.typography.titleMedium.copy(fontSize = 19.sp)
                        } else {
                            MaterialTheme.typography.titleMedium
                        },
                        fontWeight = if (item.isCompleted) FontWeight.Normal else FontWeight.SemiBold,
                        textDecoration = if (item.isCompleted) TextDecoration.LineThrough else TextDecoration.None,
                        color = if (item.isCompleted) {
                            MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                        } else {
                            MaterialTheme.colorScheme.onSurface
                        },
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )

                    // Quantity Pill
                    if (item.quantity.isNotBlank() && item.quantity != "1") {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.7f)
                        ) {
                            Text(
                                text = item.quantity,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onPrimaryContainer,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    // Urgency Badge
                    if (item.urgency == UrgencyLevel.URGENT && !item.isCompleted) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = UrgentRedBg
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.PriorityHigh,
                                    contentDescription = "Urgent",
                                    tint = UrgentRed,
                                    modifier = Modifier.size(12.dp)
                                )
                                Text(
                                    text = "Need Today",
                                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp),
                                    color = UrgentRed,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }

                // Notes Subtitle
                if (item.notes.isNotBlank()) {
                    Text(
                        text = item.notes,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }

                // Footer Metadata: Category & Who added it
                Row(
                    modifier = Modifier.padding(top = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Category Tag
                    Text(
                        text = item.category,
                        style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp),
                        color = MaterialTheme.colorScheme.secondary,
                        fontWeight = FontWeight.Medium
                    )

                    Text(
                        text = "•",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.outline
                    )

                    // Member Chip
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = if (item.addedBy == HouseholdMember.KITCHEN_TABLET) {
                                Icons.Outlined.TabletAndroid
                            } else {
                                Icons.Outlined.Person
                            },
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f),
                            modifier = Modifier.size(12.dp)
                        )
                        Spacer(modifier = Modifier.width(3.dp))
                        Text(
                            text = item.addedBy,
                            style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp),
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            // Action Buttons
            if (!isLargeTouchTarget) {
                IconButton(
                    onClick = onEdit,
                    modifier = Modifier.size(36.dp).testTag("edit_item_${item.id}")
                ) {
                    Icon(
                        imageVector = Icons.Default.Edit,
                        contentDescription = "Edit item",
                        tint = MaterialTheme.colorScheme.outline,
                        modifier = Modifier.size(18.dp)
                    )
                }

                IconButton(
                    onClick = onDelete,
                    modifier = Modifier.size(36.dp).testTag("delete_item_${item.id}")
                ) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = "Delete item",
                        tint = MaterialTheme.colorScheme.outline,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}
