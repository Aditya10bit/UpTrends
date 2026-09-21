import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteAccountModal({
  visible,
  onClose,
  onConfirm,
}: DeleteAccountModalProps) {
  const { theme, mode } = useTheme();
  const [step, setStep] = useState(1);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 1) {
      setStep(2);
    }
  };

  const handleConfirm = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsDeleting(true);
    await onConfirm();
    setIsDeleting(false);
  };

  const resetAndClose = () => {
    setStep(1);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={resetAndClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
          {step === 1 ? (
            // Step 1: Warning
            <>
              <View style={[styles.iconContainer, { backgroundColor: '#ef444420' }]}>
                <Ionicons name="warning-outline" size={32} color="#ef4444" />
              </View>
              <Text style={[styles.title, { color: theme.text }]}>Delete Account?</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Are you sure you want to delete your account? This action cannot be undone.
              </Text>
              
              <View style={styles.pointsContainer}>
                <View style={styles.pointRow}>
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  <Text style={[styles.pointText, { color: theme.text }]}>All your profile data will be erased</Text>
                </View>
                <View style={styles.pointRow}>
                  <Ionicons name="shirt-outline" size={20} color="#ef4444" />
                  <Text style={[styles.pointText, { color: theme.text }]}>Your digital wardrobe will be lost</Text>
                </View>
                <View style={styles.pointRow}>
                  <Ionicons name="chatbubbles-outline" size={20} color="#ef4444" />
                  <Text style={[styles.pointText, { color: theme.text }]}>Your stylist chat history will be deleted</Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.cancelButton, { backgroundColor: theme.surfaceElevated }]}
                  onPress={resetAndClose}
                >
                  <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.nextButton}
                  onPress={handleNext}
                >
                  <Text style={styles.nextButtonText}>I Understand</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            // Step 2: Final Confirmation
            <>
              <View style={[styles.iconContainer, { backgroundColor: '#ef444420' }]}>
                <Ionicons name="alert-circle-outline" size={32} color="#ef4444" />
              </View>
              <Text style={[styles.title, { color: theme.text }]}>Final Warning</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                We will now permanently delete all data linked to you. You cannot recover it.
              </Text>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.cancelButton, { backgroundColor: theme.surfaceElevated }]}
                  onPress={resetAndClose}
                  disabled={isDeleting}
                >
                  <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteButton, { opacity: isDeleting ? 0.7 : 1 }]}
                  onPress={handleConfirm}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.deleteButtonText}>Delete Everything</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: SCREEN_WIDTH - 40,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  pointsContainer: {
    width: '100%',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 24,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pointText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
