package com.example.ui.dialogs

import android.content.Context
import android.content.Intent
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.TabletAndroid
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.HouseholdMember
import com.example.data.sync.QrCodeGenerator
import com.example.data.sync.SyncStatus
import com.example.ui.theme.ForestPrimary
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun HouseholdPairingDialog(
    syncStatus: SyncStatus,
    onDismiss: () -> Unit,
    onSyncNow: () -> Unit,
    onUpdateHouseholdCode: (String) -> Unit,
    onSelectMember: (String) -> Unit,
    onShareListFormatted: () -> Unit
) {
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    var isEditingCode by remember { mutableStateOf(false) }
    var codeInputValue by remember { mutableStateOf(syncStatus.householdCode) }
    var copiedFeedback by remember { mutableStateOf(false) }

    // Infinite rotation animation for sync button
    val infiniteTransition = rememberInfiniteTransition(label = "syncRotation")
    val rotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "rotation"
    )

    // Generate real ZXing standard QR matrix for the household code
    val qrMatrix = remember(syncStatus.householdCode) {
        QrCodeGenerator.generateQrMatrix("https://hearthlist.app/join?code=${syncStatus.householdCode}")
    }

    val timeFormatted = remember(syncStatus.lastSyncedAt) {
        if (syncStatus.lastSyncedAt != null && syncStatus.lastSyncedAt > 0) {
            SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date(syncStatus.lastSyncedAt))
        } else {
            "Never"
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.CloudSync,
                    contentDescription = null,
                    tint = ForestPrimary,
                    modifier = Modifier.size(28.dp)
                )
                Text(
                    text = "Household Sync & Pairing",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(vertical = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Explanation Header
                Text(
                    text = "Keep your kitchen tablet and mobile phones in sync. Any item added on the tablet shows up instantly when you are at the grocery store!",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Household Code Card
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "SHARED HOUSEHOLD CODE",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
                        )

                        Spacer(modifier = Modifier.height(6.dp))

                        if (isEditingCode) {
                            OutlinedTextField(
                                value = codeInputValue,
                                onValueChange = { codeInputValue = it.uppercase() },
                                label = { Text("Enter 6-8 digit code") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.End
                            ) {
                                TextButton(onClick = { isEditingCode = false }) {
                                    Text("Cancel")
                                }
                                Button(
                                    onClick = {
                                        onUpdateHouseholdCode(codeInputValue)
                                        isEditingCode = false
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = ForestPrimary)
                                ) {
                                    Text("Save Code")
                                }
                            }
                        } else {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center
                            ) {
                                Text(
                                    text = syncStatus.householdCode,
                                    style = MaterialTheme.typography.headlineMedium.copy(fontSize = 26.sp),
                                    fontWeight = FontWeight.Black,
                                    fontFamily = FontFamily.Monospace,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                IconButton(
                                    onClick = {
                                        clipboardManager.setText(AnnotatedString(syncStatus.householdCode))
                                        copiedFeedback = true
                                    }
                                ) {
                                    Icon(
                                        imageVector = if (copiedFeedback) Icons.Default.CheckCircle else Icons.Default.ContentCopy,
                                        contentDescription = "Copy code",
                                        tint = ForestPrimary
                                    )
                                }
                                IconButton(onClick = { isEditingCode = true }) {
                                    Icon(
                                        imageVector = Icons.Default.Edit,
                                        contentDescription = "Edit code",
                                        tint = ForestPrimary
                                    )
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // QR Code Display for quick camera scanning from Phone
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = Color.White,
                    modifier = Modifier
                        .padding(8.dp)
                        .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(16.dp))
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Canvas(
                            modifier = Modifier
                                .size(190.dp)
                                .testTag("pairing_qr_canvas")
                        ) {
                            val matrixSize = qrMatrix.size
                            if (matrixSize > 0) {
                                val cellSize = size.width / matrixSize
                                drawRect(color = Color.White)

                                for (r in 0 until matrixSize) {
                                    for (c in 0 until matrixSize) {
                                        if (qrMatrix[r][c]) {
                                            drawRect(
                                                color = Color.Black,
                                                topLeft = Offset(c * cellSize, r * cellSize),
                                                size = Size(cellSize, cellSize)
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        Text(
                            text = "Point phone camera here to join automatically",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFF2D3748),
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Active Device / Member Profile
                Text(
                    text = "ACTIVE PROFILE ON THIS DEVICE",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(6.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    HouseholdMember.ALL.forEach { member ->
                        val isSelected = member == syncStatus.activeMember
                        Card(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .clickable { onSelectMember(member) },
                            colors = CardDefaults.cardColors(
                                containerColor = if (isSelected) ForestPrimary else MaterialTheme.colorScheme.surfaceVariant
                            )
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 10.dp, horizontal = 4.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Icon(
                                    imageVector = if (member == HouseholdMember.KITCHEN_TABLET) {
                                        Icons.Default.TabletAndroid
                                    } else {
                                        Icons.Outlined.Person
                                    },
                                    contentDescription = null,
                                    tint = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = member,
                                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp),
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                    color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
                                    textAlign = TextAlign.Center
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Sync Status Footer
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text(
                            text = syncStatus.statusMessage,
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = "Last sync: $timeFormatted",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    Button(
                        onClick = onSyncNow,
                        colors = ButtonDefaults.buttonColors(containerColor = ForestPrimary),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.testTag("dialog_sync_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Sync,
                            contentDescription = "Sync",
                            modifier = Modifier
                                .size(18.dp)
                                .then(if (syncStatus.isSyncing) Modifier.rotate(rotation) else Modifier)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (syncStatus.isSyncing) "Syncing…" else "Sync Now")
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Send Pairing Code & Link to Spouse Action
                Button(
                    onClick = {
                        val shareText = "Connect to our kitchen tablet on HearthList!\nHousehold Code: ${syncStatus.householdCode}\nTap to connect: https://hearthlist.app/join?code=${syncStatus.householdCode}"
                        val intent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_SUBJECT, "Connect to HearthList: ${syncStatus.householdCode}")
                            putExtra(Intent.EXTRA_TEXT, shareText)
                        }
                        context.startActivity(Intent.createChooser(intent, "Share Household Code…"))
                    },
                    modifier = Modifier.fillMaxWidth().testTag("send_code_button"),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = ForestPrimary)
                ) {
                    Icon(imageVector = Icons.Default.Share, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Send Join Code & Link to Spouse")
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Share Shopping List Action
                OutlinedButton(
                    onClick = onShareListFormatted,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(imageVector = Icons.Default.Share, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Share Shopping List via Text / WhatsApp")
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Done", fontWeight = FontWeight.Bold, color = ForestPrimary)
            }
        }
    )
}
