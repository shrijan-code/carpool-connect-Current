import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Phone, AlertTriangle, Shield, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/store/auth-store';
import { EmergencyContact as EmergencyContactType } from '@/types';
import { EmergencyContactService } from '@/services/emergency-contacts';


interface EmergencyContactProps {
  rideId?: string;
  isVisible?: boolean;
  onClose?: () => void;
  isModal?: boolean;
}

export const EmergencyContactComponent: React.FC<EmergencyContactProps> = ({
  rideId,
  isVisible = true,
  onClose,
  isModal = false,
}) => {
  const { user } = useAuthStore();
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContactType[]>([]);
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContactType | null>(null);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    relationship: '',
  });

  const loadEmergencyContacts = useCallback(async () => {
    if (!user?.id) return;
    try {
      console.log('Loading emergency contacts from service for user', user.id);
      const contacts = await EmergencyContactService.getContacts(user.id);
      setEmergencyContacts(contacts);
    } catch (error) {
      console.error('Failed to load emergency contacts:', error);
      try {
        const stored = await AsyncStorage.getItem(`emergency_contacts_${user.id}`);
        if (stored) {
          try {
            setEmergencyContacts(JSON.parse(stored));
          } catch (parseError) {
            console.warn('Failed to parse stored emergency contacts, clearing corrupted data:', parseError);
            await AsyncStorage.removeItem(`emergency_contacts_${user.id}`);
            setEmergencyContacts([]);
          }
        }
      } catch (storageError) {
        console.warn('Failed to load emergency contacts from storage:', storageError);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    loadEmergencyContacts();
  }, [loadEmergencyContacts]);

  const saveEmergencyContacts = async (contacts: EmergencyContactType[]) => {
    if (!user?.id) return;
    try {
      await AsyncStorage.setItem(`emergency_contacts_${user.id}`, JSON.stringify(contacts));
      setEmergencyContacts(contacts);
    } catch (error) {
      console.error('Failed to save emergency contacts:', error);
    }
  };

  const addEmergencyContact = () => {
    setNewContact({ name: '', phone: '', relationship: '' });
    setEditingContact(null);
    setShowAddModal(true);
  };



  const saveContact = async () => {
    if (!newContact.name.trim() || !newContact.phone.trim()) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'User not found.');
      return;
    }

    try {
      if (editingContact) {
        await EmergencyContactService.updateContact(user.id, editingContact.id, {
          name: newContact.name.trim(),
          phone: newContact.phone.trim(),
          relationship: newContact.relationship.trim() || 'Contact',
        });
      } else {
        await EmergencyContactService.createContact({
          userId: user.id,
          name: newContact.name.trim(),
          phone: newContact.phone.trim(),
          relationship: newContact.relationship.trim() || 'Contact',
          isPrimary: emergencyContacts.length === 0,
          createdAt: new Date().toISOString() as any,
          updatedAt: new Date().toISOString() as any,
        } as any);
      }

      // Reload from service to ensure sync with Firestore
      await loadEmergencyContacts();
      setShowAddModal(false);
      setNewContact({ name: '', phone: '', relationship: '' });
      setEditingContact(null);
      
      Alert.alert(
        'Success',
        editingContact ? 'Contact updated successfully!' : 'Emergency contact added successfully!'
      );
    } catch (error) {
      console.error('Failed to save contact:', error);
      Alert.alert('Error', 'Failed to save contact. Please try again.');
    }
  };

  const removeEmergencyContact = (contactId: string) => {
    Alert.alert(
      'Remove Contact',
      'Are you sure you want to remove this emergency contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;
            try {
              await EmergencyContactService.deleteContact(user.id, contactId);
              await loadEmergencyContacts();
            } catch (error) {
              console.error('Failed to remove contact:', error);
              Alert.alert('Error', 'Failed to remove contact. Please try again.');
            }
          },
        },
      ]
    );
  };

  const callEmergencyContact = async (contact: EmergencyContactType) => {
    try {
      const phoneUrl = `tel:${contact.phone}`;
      const canOpen = await Linking.canOpenURL(phoneUrl);
      
      if (canOpen) {
        await Linking.openURL(phoneUrl);
        
        // Log emergency call
        console.log(`Emergency call made to ${contact.name} (${contact.phone}) for ride ${rideId}`);
        
        // Send emergency notification if in ride
        if (rideId) {
          sendEmergencyAlert(contact);
        }
      } else {
        Alert.alert('Error', 'Unable to make phone call');
      }
    } catch (error) {
      console.error('Failed to make emergency call:', error);
      Alert.alert('Error', 'Failed to make emergency call');
    }
  };

  const sendEmergencyAlert = async (contact: EmergencyContactType) => {
    try {
      // In a real app, this would send an SMS or push notification
      const message = `EMERGENCY ALERT: I may need assistance. I'm currently in a ride (ID: ${rideId}). Please check on me. - Sent from CarpoolConnect Safety Feature`;
      
      if (Platform.OS === 'ios') {
        const smsUrl = `sms:${contact.phone}&body=${encodeURIComponent(message)}`;
        const canOpen = await Linking.canOpenURL(smsUrl);
        if (canOpen) {
          await Linking.openURL(smsUrl);
        }
      } else {
        const smsUrl = `sms:${contact.phone}?body=${encodeURIComponent(message)}`;
        const canOpen = await Linking.canOpenURL(smsUrl);
        if (canOpen) {
          await Linking.openURL(smsUrl);
        }
      }
    } catch (error) {
      console.error('Failed to send emergency SMS:', error);
    }
  };

  const triggerEmergencyMode = () => {
    setIsEmergencyMode(true);
    
    Alert.alert(
      '🚨 Emergency Mode Activated',
      'Emergency contacts will be notified. Choose an action:',
      [
        {
          text: 'Call 911',
          onPress: () => callEmergencyServices(),
        },
        {
          text: 'Contact Emergency Contact',
          onPress: () => showEmergencyContactOptions(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => setIsEmergencyMode(false),
        },
      ]
    );
  };

  const callEmergencyServices = async () => {
    try {
      // For Australia, use 000. For US, use 911
      const emergencyNumber = 'tel:000'; // Australian emergency number
      const canOpen = await Linking.canOpenURL(emergencyNumber);
      
      if (canOpen) {
        await Linking.openURL(emergencyNumber);
        console.log('Emergency services called');
      } else {
        Alert.alert('Error', 'Unable to make emergency call');
      }
    } catch (error) {
      console.error('Failed to call emergency services:', error);
      Alert.alert('Error', 'Failed to call emergency services');
    }
  };

  const showEmergencyContactOptions = () => {
    if (emergencyContacts.length === 0) {
      Alert.alert(
        'No Emergency Contacts',
        'Please add emergency contacts first.',
        [{ text: 'Add Contact', onPress: addEmergencyContact }]
      );
      return;
    }

    const options = emergencyContacts.map(contact => ({
      text: `${contact.name} (${contact.relationship})`,
      onPress: () => callEmergencyContact(contact),
    }));

    options.push({ text: 'Cancel', style: 'cancel' as const });

    Alert.alert('Choose Emergency Contact', '', options);
  };

  const renderAddContactModal = () => (
    <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {editingContact ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
          </Text>
          <TouchableOpacity onPress={() => setShowAddModal(false)}>
            <X size={24} color="#495057" />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Name *</Text>
            <TextInput
              style={styles.textInput}
              value={newContact.name}
              onChangeText={(text) => setNewContact(prev => ({ ...prev, name: text }))}
              placeholder="Enter full name"
              autoCapitalize="words"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number *</Text>
            <TextInput
              style={styles.textInput}
              value={newContact.phone}
              onChangeText={(text) => setNewContact(prev => ({ ...prev, phone: text }))}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Relationship</Text>
            <TextInput
              style={styles.textInput}
              value={newContact.relationship}
              onChangeText={(text) => setNewContact(prev => ({ ...prev, relationship: text }))}
              placeholder="e.g., Spouse, Parent, Friend"
              autoCapitalize="words"
            />
          </View>
          
          <View style={styles.infoBox}>
            <AlertTriangle size={20} color="#856404" />
            <Text style={styles.infoText}>
              This contact will be notified in case of an emergency during your rides. 
              Make sure they are aware and available to help.
            </Text>
          </View>
        </ScrollView>
        
        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.saveButton} onPress={saveContact}>
            <Text style={styles.saveButtonText}>
              {editingContact ? 'Update Contact' : 'Add Contact'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  if (!isVisible) return null;

  if (isModal) {
    return (
      <Modal visible={isVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Emergency Contacts</Text>
            {onClose && (
              <TouchableOpacity onPress={onClose}>
                <X size={24} color="#495057" />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView style={styles.modalContent}>
            <View style={styles.header}>
              <Shield size={24} color="#dc3545" />
              <Text style={styles.title}>Emergency Contacts</Text>
            </View>

            {emergencyContacts.length === 0 ? (
              <View style={styles.emptyState}>
                <AlertTriangle size={48} color="#6c757d" />
                <Text style={styles.emptyText}>No emergency contacts added</Text>
                <Text style={styles.emptySubtext}>
                  Add trusted contacts who can be reached in case of emergency
                </Text>
                <TouchableOpacity style={styles.addButton} onPress={addEmergencyContact}>
                  <Text style={styles.addButtonText}>Add Emergency Contact</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.contactsList}>
                  {emergencyContacts.map(contact => (
                    <View key={contact.id} style={styles.contactItem}>
                      <View style={styles.contactInfo}>
                        <Text style={styles.contactName}>{contact.name}</Text>
                        <Text style={styles.contactDetails}>
                          {contact.relationship} • {contact.phone}
                        </Text>
                      </View>
                      <View style={styles.contactActions}>
                        <TouchableOpacity
                          style={styles.callButton}
                          onPress={() => callEmergencyContact(contact)}
                        >
                          <Phone size={16} color="#ffffff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.editButton}
                          onPress={() => {
                            setNewContact({
                              name: contact.name,
                              phone: contact.phone,
                              relationship: contact.relationship
                            });
                            setEditingContact(contact);
                            setShowAddModal(true);
                          }}
                        >
                          <Text style={styles.editButtonText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() => removeEmergencyContact(contact.id)}
                        >
                          <Text style={styles.removeButtonText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>

                <TouchableOpacity style={styles.addMoreButton} onPress={addEmergencyContact}>
                  <Text style={styles.addMoreButtonText}>+ Add Another Contact</Text>
                </TouchableOpacity>
              </>
            )}

            {rideId && (
              <TouchableOpacity
                style={[styles.emergencyButton, isEmergencyMode && styles.emergencyButtonActive]}
                onPress={triggerEmergencyMode}
              >
                <AlertTriangle size={20} color="#ffffff" />
                <Text style={styles.emergencyButtonText}>
                  {isEmergencyMode ? 'Emergency Mode Active' : 'Emergency Alert'}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
        {renderAddContactModal()}
      </Modal>
    );
  }

  const content = (
    <View style={styles.container}>
      <View style={styles.header}>
        <Shield size={24} color="#dc3545" />
        <Text style={styles.title}>Emergency Contacts</Text>
      </View>

      {emergencyContacts.length === 0 ? (
        <View style={styles.emptyState}>
          <AlertTriangle size={48} color="#6c757d" />
          <Text style={styles.emptyText}>No emergency contacts added</Text>
          <Text style={styles.emptySubtext}>
            Add trusted contacts who can be reached in case of emergency
          </Text>
          <TouchableOpacity style={styles.addButton} onPress={addEmergencyContact}>
            <Text style={styles.addButtonText}>Add Emergency Contact</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.contactsList}>
            {emergencyContacts.map(contact => (
              <View key={contact.id} style={styles.contactItem}>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactDetails}>
                    {contact.relationship} • {contact.phone}
                  </Text>
                </View>
                <View style={styles.contactActions}>
                  <TouchableOpacity
                    style={styles.callButton}
                    onPress={() => callEmergencyContact(contact)}
                  >
                    <Phone size={16} color="#ffffff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeEmergencyContact(contact.id)}
                  >
                    <Text style={styles.removeButtonText}>×</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.addMoreButton} onPress={addEmergencyContact}>
            <Text style={styles.addMoreButtonText}>+ Add Another Contact</Text>
          </TouchableOpacity>
        </>
      )}

      {rideId && (
        <TouchableOpacity
          style={[styles.emergencyButton, isEmergencyMode && styles.emergencyButtonActive]}
          onPress={triggerEmergencyMode}
        >
          <AlertTriangle size={20} color="#ffffff" />
          <Text style={styles.emergencyButtonText}>
            {isEmergencyMode ? 'Emergency Mode Active' : 'Emergency Alert'}
          </Text>
        </TouchableOpacity>
      )}
      {renderAddContactModal()}
    </View>
  );

  return content;
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  contactsList: {
    marginBottom: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  contactDetails: {
    fontSize: 14,
    color: '#6c757d',
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  callButton: {
    backgroundColor: '#28a745',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    backgroundColor: '#dc3545',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  editButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  addMoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#007bff',
    borderRadius: 8,
    marginBottom: 16,
  },
  addMoreButtonText: {
    color: '#007bff',
    fontSize: 14,
    fontWeight: '600',
  },
  emergencyButton: {
    backgroundColor: '#dc3545',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  emergencyButtonActive: {
    backgroundColor: '#721c24',
  },
  emergencyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalContainerStyle: {
    margin: 0,
    borderRadius: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  infoText: {
    fontSize: 12,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  saveButton: {
    backgroundColor: '#007bff',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});