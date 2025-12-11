import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MapPin,
  Navigation,
  Phone,
  MessageCircle,
  Clock,
  CheckCircle,
  Package,
  Truck,
  User,
  Star,
  X,
  Camera,
  Upload,
} from 'lucide-react-native';
import { Delivery, User as UserType } from '@/types';
import { DeliveryService } from '@/services/delivery';
import { useAuthStore } from '@/store/auth-store';
import { AuthService } from '@/services/auth';

interface DeliveryTrackingProps {
  delivery: Delivery;
  onClose: () => void;
  onChatPress?: () => void;
}

const STATUS_STEPS = [
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'matched', label: 'Driver Assigned', icon: User },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { key: 'picked_up', label: 'Picked Up', icon: Package },
  { key: 'in_transit', label: 'In Transit', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle },
];

export const DeliveryTracking: React.FC<DeliveryTrackingProps> = ({
  delivery,
  onClose,
  onChatPress,
}) => {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [deliveryData, setDeliveryData] = useState<Delivery>(delivery);
  const [driverInfo, setDriverInfo] = useState<UserType | null>(null);
  const [businessInfo, setBusinessInfo] = useState<UserType | null>(null);

  const isDriver = user?.id === delivery.driverId;
  const isBusiness = user?.id === delivery.businessId;
  const canUpdateStatus = isDriver && ['matched', 'confirmed', 'picked_up', 'in_transit'].includes(deliveryData.status);

  useEffect(() => {
    loadDeliveryDetails();
  }, [delivery.id]);

  // Update local delivery data when prop changes
  useEffect(() => {
    setDeliveryData(delivery);
  }, [delivery]);

  const loadDeliveryDetails = async () => {
    try {
      // Load driver information from Firebase
      if (delivery.driverId) {
        // Fetch real driver data from Firebase
        const driverProfile = await AuthService.getUserProfile(delivery.driverId);
        
        let driverName = 'Driver';
        let driverPhone = '+61 400 123 456';
        let driverRating = 4.8;
        let driverEmail = `driver${delivery.driverId.slice(-4)}@example.com`;
        let driverPhotoURL = '';
        let driverTotalRides = 150;
        
        if (driverProfile) {
          // Use real driver data from Firebase
          driverName = driverProfile.name || driverProfile.displayName || driverName;
          driverPhone = driverProfile.phone || driverPhone;
          driverRating = driverProfile.rating || driverRating;
          driverEmail = driverProfile.email || driverEmail;
          driverPhotoURL = driverProfile.photoURL || '';
          driverTotalRides = driverProfile.totalRides || 150;
          console.log(`Loaded real driver data for ${delivery.driverId}:`, driverName, driverPhone);
        }
        // Use delivery.driver data if available as fallback
        else if (delivery.driver) {
          driverName = delivery.driver.name || delivery.driver.displayName || driverName;
          driverPhone = delivery.driver.phone || driverPhone;
          driverRating = delivery.driver.rating || driverRating;
          driverEmail = delivery.driver.email || driverEmail;
          driverPhotoURL = delivery.driver.photoURL || '';
          driverTotalRides = delivery.driver.totalRides || 150;
        }
        // If this is the current user, use their data
        else if (delivery.driverId === user?.id && user) {
          driverName = user.name || user.displayName || driverName;
          driverPhone = user.phone || driverPhone;
          driverRating = user.rating || driverRating;
          driverEmail = user.email || driverEmail;
          driverPhotoURL = user.photoURL || '';
          driverTotalRides = user.totalRides || 150;
        }
        
        setDriverInfo({
          id: delivery.driverId,
          name: driverName,
          displayName: driverName,
          email: driverEmail,
          phone: driverPhone,
          photoURL: driverPhotoURL,
          role: 'driver',
          canBeDriver: true,
          canBeRider: false,
          rating: driverRating,
          totalRides: driverTotalRides,
          joinedDate: '2023-01-01',
          verified: true,
          createdAt: '2023-01-01',
          updatedAt: '2023-01-01',
        });
      }

      // Load business information from Firebase
      if (delivery.businessId) {
        // Fetch real business data from Firebase
        const businessProfile = await AuthService.getUserProfile(delivery.businessId);
        
        let businessName = 'Business User';
        let businessPhone = '+61 400 789 012';
        let businessRating = 4.5;
        let businessEmail = `user${delivery.businessId.slice(-4)}@example.com`;
        let businessPhotoURL = '';
        let businessTotalRides = 25;
        
        if (businessProfile) {
          // Use real business data from Firebase
          businessName = businessProfile.name || businessProfile.displayName || businessName;
          businessPhone = businessProfile.phone || businessPhone;
          businessRating = businessProfile.rating || businessRating;
          businessEmail = businessProfile.email || businessEmail;
          businessPhotoURL = businessProfile.photoURL || '';
          businessTotalRides = businessProfile.totalRides || 25;
          console.log(`Loaded real business data for ${delivery.businessId}:`, businessName, businessPhone);
        }
        // Use delivery.business data if available as fallback
        else if (delivery.business) {
          businessName = delivery.business.name || delivery.business.displayName || businessName;
          businessPhone = delivery.business.phone || businessPhone;
          businessRating = delivery.business.rating || businessRating;
          businessEmail = delivery.business.email || businessEmail;
          businessPhotoURL = delivery.business.photoURL || '';
          businessTotalRides = delivery.business.totalDeliveries || 25;
        }
        // If this is the current user, use their data
        else if (delivery.businessId === user?.id && user) {
          businessName = user.name || user.displayName || businessName;
          businessPhone = user.phone || businessPhone;
          businessRating = user.rating || businessRating;
          businessEmail = user.email || businessEmail;
          businessPhotoURL = user.photoURL || '';
          businessTotalRides = user.totalRides || 25;
        }
        
        setBusinessInfo({
          id: delivery.businessId,
          name: businessName,
          displayName: businessName,
          email: businessEmail,
          phone: businessPhone,
          photoURL: businessPhotoURL,
          role: 'rider',
          canBeDriver: false,
          canBeRider: true,
          rating: businessRating,
          totalRides: businessTotalRides,
          joinedDate: '2023-01-01',
          verified: true,
          createdAt: '2023-01-01',
          updatedAt: '2023-01-01',
        });
      }
    } catch (error) {
      console.error('Failed to load delivery details:', error);
    }
  };

  const updateDeliveryStatus = async (newStatus: Delivery['status']) => {
    if (!canUpdateStatus) return;

    setIsLoading(true);
    try {
      await DeliveryService.updateDeliveryStatus(deliveryData.id, newStatus);
      
      // Update local state with timestamp
      const now = new Date().toISOString();
      const updatedData = { ...deliveryData, status: newStatus };
      
      switch (newStatus) {
        case 'confirmed':
          updatedData.confirmedAt = now;
          break;
        case 'picked_up':
          updatedData.actualPickupTime = now;
          break;
        case 'in_transit':
          updatedData.inTransitAt = now;
          updatedData.estimatedDeliveryTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
          break;
        case 'delivered':
          updatedData.actualDeliveryTime = now;
          break;
      }
      
      setDeliveryData(updatedData);
      
      Alert.alert(
        'Status Updated',
        `Delivery status updated to ${newStatus.replace('_', ' ')}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to update delivery status:', error);
      Alert.alert('Error', 'Failed to update delivery status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCall = (phoneNumber: string) => {
    if (!phoneNumber) {
      Alert.alert('Error', 'Phone number not available');
      return;
    }
    
    console.log(`Calling phone number: ${phoneNumber}`);
    const url = `tel:${phoneNumber}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          Alert.alert('Error', 'Phone calls are not supported on this device');
        }
      })
      .catch((error) => {
        console.error('Failed to make call:', error);
        Alert.alert('Error', 'Failed to make call. Please try again.');
      });
  };

  const openMaps = (location: { latitude: number; longitude: number; address: string }) => {
    const url = Platform.select({
      ios: `maps:0,0?q=${location.latitude},${location.longitude}`,
      android: `geo:0,0?q=${location.latitude},${location.longitude}`,
      default: `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`,
    });

    Linking.canOpenURL(url!)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url!);
        } else {
          // Fallback to Google Maps web
          const webUrl = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
          Linking.openURL(webUrl);
        }
      })
      .catch((error) => {
        console.error('Failed to open maps:', error);
        Alert.alert('Error', 'Failed to open maps');
      });
  };

  const getCurrentStepIndex = () => {
    return STATUS_STEPS.findIndex(step => step.key === deliveryData.status);
  };

  const getNextStatus = (): Delivery['status'] | null => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex < STATUS_STEPS.length - 1) {
      return STATUS_STEPS[currentIndex + 1].key as Delivery['status'];
    }
    return null;
  };

  const renderStatusProgress = () => {
    const currentIndex = getCurrentStepIndex();

    const getStatusTime = (status: string) => {
      switch (status) {
        case 'pending': return 'Waiting for driver';
        case 'matched': return 'Driver assigned';
        case 'confirmed': return 'Pickup confirmed';
        case 'picked_up': return deliveryData.actualPickupTime ? 
          `Picked up at ${new Date(deliveryData.actualPickupTime).toLocaleTimeString()}` : 
          'Items collected';
        case 'in_transit': return 'Estimated: 15-30 min';
        case 'delivered': return deliveryData.actualDeliveryTime ? 
          `Delivered at ${new Date(deliveryData.actualDeliveryTime).toLocaleTimeString()}` : 
          'Delivery completed';
        default: return '';
      }
    };

    return (
      <View style={styles.statusProgress}>
        <Text style={styles.sectionTitle}>Delivery Progress</Text>
        {STATUS_STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const IconComponent = step.icon;

          return (
            <View key={step.key} style={styles.statusStep}>
              <View style={styles.statusStepLeft}>
                <View style={[
                  styles.statusIcon,
                  isCompleted && styles.statusIconCompleted,
                  isCurrent && styles.statusIconCurrent,
                ]}>
                  <IconComponent 
                    size={16} 
                    color={isCompleted || isCurrent ? '#ffffff' : '#6b7280'} 
                  />
                </View>
                {index < STATUS_STEPS.length - 1 && (
                  <View style={[
                    styles.statusLine,
                    isCompleted && styles.statusLineCompleted,
                  ]} />
                )}
              </View>
              <View style={styles.statusStepRight}>
                <Text style={[
                  styles.statusLabel,
                  isCompleted && styles.statusLabelCompleted,
                  isCurrent && styles.statusLabelCurrent,
                ]}>
                  {step.label}
                </Text>
                {(isCurrent || isCompleted) && (
                  <Text style={styles.statusTime}>{getStatusTime(step.key)}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderContactInfo = () => {
    const contactPerson = isDriver ? businessInfo : driverInfo;
    const contactRole = isDriver ? 'Business Contact' : 'Driver';

    if (!contactPerson) return null;

    return (
      <View style={styles.contactSection}>
        <Text style={styles.sectionTitle}>{contactRole}</Text>
        <View style={styles.contactCard}>
          <View style={styles.contactInfo}>
            <View style={styles.contactHeader}>
              <User size={20} color="#374151" />
              <Text style={styles.contactName}>{contactPerson.name}</Text>
              <View style={styles.ratingContainer}>
                <Star size={14} color="#f59e0b" fill="#f59e0b" />
                <Text style={styles.ratingText}>{contactPerson.rating}</Text>
              </View>
            </View>
            <Text style={styles.contactPhone}>{contactPerson.phone}</Text>
          </View>
          <View style={styles.contactActions}>
            <TouchableOpacity
              style={styles.contactButton}
              onPress={() => handleCall(contactPerson.phone)}
              testID={`call-${contactPerson.id}`}
            >
              <Phone size={18} color="#2563eb" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contactButton}
              onPress={() => {
                if (onChatPress) {
                  onChatPress();
                } else {
                  Alert.alert('Chat', `Opening chat with ${contactPerson.name}`);
                }
              }}
              testID={`chat-${contactPerson.id}`}
            >
              <MessageCircle size={18} color="#059669" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderLocationInfo = () => (
    <View style={styles.locationSection}>
      <Text style={styles.sectionTitle}>Locations</Text>
      
      <TouchableOpacity
        style={styles.locationCard}
        onPress={() => openMaps({
          latitude: deliveryData.pickupLocation.latitude,
          longitude: deliveryData.pickupLocation.longitude,
          address: deliveryData.pickupLocation.address,
        })}
      >
        <View style={styles.locationInfo}>
          <View style={[styles.locationDot, styles.pickupDot]} />
          <View style={styles.locationText}>
            <Text style={styles.locationLabel}>Pickup Location</Text>
            <Text style={styles.locationAddress}>{deliveryData.pickupLocation.address}</Text>
          </View>
        </View>
        <Navigation size={20} color="#6b7280" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.locationCard}
        onPress={() => openMaps({
          latitude: deliveryData.dropoffLocation.latitude,
          longitude: deliveryData.dropoffLocation.longitude,
          address: deliveryData.dropoffLocation.address,
        })}
      >
        <View style={styles.locationInfo}>
          <View style={[styles.locationDot, styles.dropoffDot]} />
          <View style={styles.locationText}>
            <Text style={styles.locationLabel}>Delivery Location</Text>
            <Text style={styles.locationAddress}>{deliveryData.dropoffLocation.address}</Text>
          </View>
        </View>
        <Navigation size={20} color="#6b7280" />
      </TouchableOpacity>
    </View>
  );

  const renderDriverActions = () => {
    if (!canUpdateStatus) return null;

    const nextStatus = getNextStatus();
    if (!nextStatus) return null;

    const getActionText = () => {
      switch (nextStatus) {
        case 'confirmed': return 'Confirm Pickup';
        case 'picked_up': return 'Mark as Picked Up';
        case 'in_transit': return 'Start Delivery';
        case 'delivered': return 'Mark as Delivered';
        default: return 'Update Status';
      }
    };

    const getActionDescription = () => {
      switch (nextStatus) {
        case 'confirmed': return 'Confirm that you will pick up this delivery';
        case 'picked_up': return 'Mark when you have collected the items';
        case 'in_transit': return 'Start the delivery journey';
        case 'delivered': return 'Complete the delivery with proof';
        default: return 'Update the delivery status';
      }
    };

    return (
      <View style={styles.actionsSection}>
        <View style={styles.actionInfo}>
          <Text style={styles.actionTitle}>Next Step</Text>
          <Text style={styles.actionDescription}>{getActionDescription()}</Text>
        </View>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            if (nextStatus === 'delivered') {
              setShowProofModal(true);
            } else {
              updateDeliveryStatus(nextStatus);
            }
          }}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>{getActionText()}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const handleTakePhoto = async () => {
    try {
      // In a real app, this would use expo-camera or expo-image-picker
      console.log('Taking photo for delivery proof');
      Alert.alert(
        'Photo Captured',
        'Delivery proof photo has been captured and will be attached to the delivery record.',
        [{ text: 'OK' }]
      );
      
      // Simulate photo capture and upload
      const proofData = {
        photoUrl: `https://example.com/delivery-proof/${deliveryData.id}.jpg`,
        timestamp: new Date().toISOString(),
        location: deliveryData.dropoffLocation,
      };
      
      // Complete delivery with proof
      setShowProofModal(false);
      await updateDeliveryStatusWithProof('delivered', proofData);
    } catch (error) {
      console.error('Failed to capture photo:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  const handleUploadPhoto = async () => {
    try {
      // In a real app, this would use expo-document-picker
      console.log('Uploading photo for delivery proof');
      Alert.alert(
        'Photo Uploaded',
        'Delivery proof photo has been uploaded and attached to the delivery record.',
        [{ text: 'OK' }]
      );
      
      // Simulate photo upload
      const proofData = {
        photoUrl: `https://example.com/delivery-proof/${deliveryData.id}-uploaded.jpg`,
        timestamp: new Date().toISOString(),
        location: deliveryData.dropoffLocation,
      };
      
      // Complete delivery with proof
      setShowProofModal(false);
      await updateDeliveryStatusWithProof('delivered', proofData);
    } catch (error) {
      console.error('Failed to upload photo:', error);
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
    }
  };

  const updateDeliveryStatusWithProof = async (newStatus: Delivery['status'], proof?: any) => {
    if (!canUpdateStatus) return;

    setIsLoading(true);
    try {
      await DeliveryService.updateDeliveryStatus(deliveryData.id, newStatus, proof);
      
      // Update local state with timestamp and proof
      const now = new Date().toISOString();
      const updatedData = { ...deliveryData, status: newStatus };
      
      if (newStatus === 'delivered') {
        updatedData.actualDeliveryTime = now;
        if (proof) {
          updatedData.deliveryProof = proof;
        }
      }
      
      setDeliveryData(updatedData);
      
      Alert.alert(
        'Delivery Completed',
        'Delivery has been marked as completed with proof of delivery.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to update delivery status with proof:', error);
      Alert.alert('Error', 'Failed to complete delivery. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderProofModal = () => (
    <Modal
      visible={showProofModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowProofModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Delivery Proof</Text>
          <TouchableOpacity onPress={() => setShowProofModal(false)}>
            <X size={24} color="#374151" />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent}>
          <Text style={styles.proofInstructions}>
            Please provide proof of delivery to complete this order. This helps ensure accountability and customer satisfaction.
          </Text>
          
          <View style={styles.proofOptions}>
            <TouchableOpacity style={styles.proofButton} onPress={handleTakePhoto}>
              <Camera size={20} color="#2563eb" />
              <Text style={styles.proofButtonText}>Take Photo</Text>
              <Text style={styles.proofButtonSubtext}>Capture delivery location</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.proofButton} onPress={handleUploadPhoto}>
              <Upload size={20} color="#2563eb" />
              <Text style={styles.proofButtonText}>Upload Photo</Text>
              <Text style={styles.proofButtonSubtext}>Choose from gallery</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.proofTips}>
            <Text style={styles.proofTipsTitle}>📸 Photo Tips:</Text>
            <Text style={styles.proofTip}>• Include the delivery address or building number</Text>
            <Text style={styles.proofTip}>• Show the delivered items if possible</Text>
            <Text style={styles.proofTip}>• Ensure the photo is clear and well-lit</Text>
          </View>
        </ScrollView>
        
        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => {
              Alert.alert(
                'Skip Photo?',
                'Are you sure you want to complete delivery without photo proof?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Complete Without Photo',
                    onPress: () => {
                      setShowProofModal(false);
                      updateDeliveryStatus('delivered');
                    }
                  }
                ]
              );
            }}
          >
            <Text style={styles.skipButtonText}>Complete Without Photo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Track Delivery</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderStatusProgress()}
          {renderContactInfo()}
          {renderLocationInfo()}
          
          <View style={styles.deliveryDetails}>
            <Text style={styles.sectionTitle}>Delivery Details</Text>
            <View style={styles.detailsCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Items:</Text>
                <Text style={styles.detailValue}>
                  {`${deliveryData.items.length} item${deliveryData.items.length !== 1 ? 's' : ''}`}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Package Size:</Text>
                <Text style={styles.detailValue}>{deliveryData.packageSize}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Delivery Fee:</Text>
                <Text style={styles.detailValue}>{`${(deliveryData.priceCents / 100).toFixed(2)}`}</Text>
              </View>
              {deliveryData.specialInstructions && (
                <View style={styles.instructionsContainer}>
                  <Text style={styles.detailLabel}>Special Instructions:</Text>
                  <Text style={styles.instructionsText}>{deliveryData.specialInstructions}</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {renderDriverActions()}
        {renderProofModal()}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  statusProgress: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statusStep: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statusStepLeft: {
    alignItems: 'center',
    marginRight: 12,
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconCompleted: {
    backgroundColor: '#059669',
  },
  statusIconCurrent: {
    backgroundColor: '#2563eb',
  },
  statusLine: {
    width: 2,
    height: 24,
    backgroundColor: '#e5e7eb',
    marginTop: 4,
  },
  statusLineCompleted: {
    backgroundColor: '#059669',
  },
  statusStepRight: {
    flex: 1,
    justifyContent: 'center',
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
  },
  statusLabelCompleted: {
    color: '#059669',
  },
  statusLabelCurrent: {
    color: '#2563eb',
    fontWeight: '600',
  },
  statusTime: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  contactSection: {
    marginBottom: 16,
  },
  contactCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactInfo: {
    flex: 1,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginLeft: 4,
  },
  contactPhone: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 28,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  contactButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationSection: {
    marginBottom: 16,
  },
  locationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  pickupDot: {
    backgroundColor: '#059669',
  },
  dropoffDot: {
    backgroundColor: '#dc2626',
  },
  locationText: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 14,
    color: '#6b7280',
  },
  deliveryDetails: {
    marginBottom: 16,
  },
  detailsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
  },
  instructionsContainer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  instructionsText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    lineHeight: 20,
  },
  actionsSection: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionInfo: {
    marginBottom: 16,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  proofInstructions: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 24,
    lineHeight: 24,
  },
  proofButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  proofButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2563eb',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  completeButton: {
    backgroundColor: '#059669',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  proofOptions: {
    gap: 12,
    marginBottom: 24,
  },
  proofButtonSubtext: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  proofTips: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  proofTipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 8,
  },
  proofTip: {
    fontSize: 13,
    color: '#0369a1',
    marginBottom: 4,
    lineHeight: 18,
  },
  skipButton: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  skipButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
});