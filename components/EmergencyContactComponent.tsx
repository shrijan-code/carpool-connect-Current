import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { EmergencyContact } from '@/types';
import { EmergencyContactService } from '@/services/emergency-contacts';
import { useAuthStore } from '@/store/auth-store';
import {
  X,
  Plus,
  Phone,
  User,
  Edit,
  Trash2,
  Star,
  Users,
  AlertTriangle,
} from 'lucide-react-native';

interface EmergencyContactComponentProps {
  isVisible: boolean;
  onClose: () => void;
  isModal?: boolean;
}

export function EmergencyContactComponent({
  isVisible,
  onClose,
  isModal = true,
}: EmergencyContactComponentProps) {
  const { user } = useAuthStore();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    relationship: '',
    isPrimary: false,
  });
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (isVisible && user?.id) {
      loadContacts();
    }
  }, [isVisible, user?.id]);

  const loadContacts = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const userContacts = await EmergencyContactService.getContacts(user.id);
      setContacts(userContacts);
    } catch (error) {
      console.error('Failed to load emergency contacts:', error);
      Alert.alert('Error', 'Failed to load emergency contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = () => {
    setFormData({
      name: '',
      phone: '',
      relationship: '',
      isPrimary: contacts.length === 0,
    });
    setEditingContact(null);
    setShowAddModal(true);
  };

  const handleEditContact = (contact: EmergencyContact) => {
    setFormData({
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship,
      isPrimary: contact.isPrimary,
    });
    setEditingContact(contact);
    setShowAddModal(true);
  };

  const handleSaveContact = async () => {
    if (!user?.id) return;
    
    const errors = EmergencyContactService.validateContact(formData);
    if (errors.length > 0) {
      Alert.alert('Validation Error', errors.join('\n'));
      return;
    }

    try {
      setSaving(true);
      
      if (editingContact) {
        await EmergencyContactService.updateContact(
          user.id,
          editingContact.id,
          formData
        );
      } else {
        await EmergencyContactService.createContact({
          ...formData,
          userId: user.id,
        });
      }
      
      setShowAddModal(false);
      await loadContacts();
      Alert.alert(
        'Success',
        `Emergency contact ${editingContact ? 'updated' : 'added'} successfully`
      );
    } catch (error: any) {
      console.error('Failed to save emergency contact:', error);
      Alert.alert('Error', error.message || 'Failed to save emergency contact');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = (contact: EmergencyContact) => {
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to delete ${contact.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;
            
            try {
              await EmergencyContactService.deleteContact(user.id, contact.id);
              await loadContacts();
              Alert.alert('Success', 'Emergency contact deleted successfully');
            } catch (error: any) {
              console.error('Failed to delete emergency contact:', error);
              Alert.alert('Error', error.message || 'Failed to delete emergency contact');
            }
          },
        },
      ]
    );
  };

  const renderContactItem = (contact: EmergencyContact) => (
    <View key={contact.id} style={styles.contactItem}>
      <View style={styles.contactInfo}>
        <View style={styles.contactHeader}>
          <View style={styles.contactName}>
            <User size={20} color={Colors.primary} />
            <Text style={styles.contactNameText}>{contact.name}</Text>
            {contact.isPrimary && (
              <View style={styles.primaryBadge}>
                <Star size={12} color={Colors.background} fill={Colors.warning} />
                <Text style={styles.primaryText}>Primary</Text>
              </View>
            )}
          </View>
          <View style={styles.contactActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleEditContact(contact)}
            >
              <Edit size={16} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleDeleteContact(contact)}
            >
              <Trash2 size={16} color={Colors.error} />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.contactDetails}>
          <View style={styles.contactDetail}>
            <Phone size={16} color={Colors.textSecondary} />
            <Text style={styles.contactDetailText}>{contact.phone}</Text>
          </View>
          <View style={styles.contactDetail}>
            <Users size={16} color={Colors.textSecondary} />
            <Text style={styles.contactDetailText}>{contact.relationship}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const content = (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Emergency Contacts</Text>
        {isModal && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={Colors.text} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.description}>
        <AlertTriangle size={20} color={Colors.warning} />
        <Text style={styles.descriptionText}>
          Add emergency contacts who will be notified in case of an emergency during your ride.
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading contacts...</Text>
          </View>
        ) : contacts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Users size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>No Emergency Contacts</Text>
            <Text style={styles.emptyText}>
              Add emergency contacts to ensure your safety during rides.
            </Text>
          </View>
        ) : (
          <View style={styles.contactsList}>
            {contacts.map(renderContactItem)}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.addButton} onPress={handleAddContact}>
        <Plus size={20} color={Colors.background} />
        <Text style={styles.addButtonText}>Add Emergency Contact</Text>
      </TouchableOpacity>

      {/* Add/Edit Contact Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingContact ? 'Edit Contact' : 'Add Emergency Contact'}
            </Text>
            <TouchableOpacity
              onPress={() => setShowAddModal(false)}
              style={styles.closeButton}
            >
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                placeholder="Enter full name"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Phone Number *</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
                placeholder="Enter phone number"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Relationship *</Text>
              <TextInput
                style={styles.input}
                value={formData.relationship}
                onChangeText={(text) => setFormData(prev => ({ ...prev, relationship: text }))}
                placeholder="e.g., Spouse, Parent, Friend"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            <TouchableOpacity
              style={styles.primaryToggle}
              onPress={() => setFormData(prev => ({ ...prev, isPrimary: !prev.isPrimary }))}
            >
              <View style={styles.primaryToggleContent}>
                <View style={styles.primaryToggleInfo}>
                  <Text style={styles.primaryToggleTitle}>Primary Contact</Text>
                  <Text style={styles.primaryToggleSubtitle}>
                    This contact will be notified first in emergencies
                  </Text>
                </View>
                <View style={[
                  styles.toggle,
                  formData.isPrimary && styles.toggleActive
                ]}>
                  {formData.isPrimary && (
                    <View style={styles.toggleIndicator} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowAddModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={handleSaveContact}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={Colors.background} />
              ) : (
                <Text style={styles.saveButtonText}>
                  {editingContact ? 'Update' : 'Add'} Contact
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );

  if (isModal) {
    return (
      <Modal
        visible={isVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.modalContainer}>
          {content}
        </SafeAreaView>
      </Modal>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  description: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    backgroundColor: '#fff8e1',
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  descriptionText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    marginLeft: 12,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  contactsList: {
    gap: 12,
  },
  contactItem: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  contactInfo: {
    flex: 1,
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  contactName: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  contactNameText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginLeft: 8,
    flex: 1,
  },
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  primaryText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.background,
    marginLeft: 4,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  deleteButton: {
    backgroundColor: '#ffebee',
  },
  contactDetails: {
    gap: 8,
  },
  contactDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactDetailText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    margin: 20,
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.background,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: Colors.text,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  primaryToggle: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  primaryToggleContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  primaryToggleInfo: {
    flex: 1,
  },
  primaryToggleTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  primaryToggleSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: Colors.primary,
    alignItems: 'flex-end',
  },
  toggleIndicator: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.background,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  saveButton: {
    backgroundColor: Colors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.background,
  },
});