import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, Linking, Image, ActionSheetIOS, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { useRidesStore } from '@/store/rides-store';
import { NotificationBell } from '@/components/NotificationBell';
import { ImageService } from '@/services/image';
import { StripeConnectService } from '@/services/stripe';
import { SettingsScreen } from '@/components/SettingsScreen';
import { useSettingsStore } from '@/store/settings-store';
import { EmergencyContactComponent } from '@/src/components/EmergencyContact';
import { SafetyReportComponent } from '@/src/components/SafetyReport';
import { VerificationService, VerificationStatus } from '@/services/verification';
import { VerificationBadge } from '@/components/VerificationBadge';
import { FAQ, TERMS_OF_SERVICE, PRIVACY_POLICY } from '@/constants/legal-text';
import {
  Star,
  Calendar,
  Shield,
  Settings,
  HelpCircle,
  Edit,
  Car,
  Users,
  Phone,
  Mail,
  X,
  Lock,
  MessageCircle,
  FileText,
  ExternalLink,
  Save,
  Camera,
  Upload,
  File,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Clock
} from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, logout, deleteAccount, updateUser } = useAuthStore();
  const { getUserRides } = useRidesStore();
  const { loadSettings } = useSettingsStore();
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [infoModalTitle, setInfoModalTitle] = useState<string>('');
  const [infoModalContent, setInfoModalContent] = useState<string>('');
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showSafetyModal, setShowSafetyModal] = useState<boolean>(false);
  const [showEmergencyContacts, setShowEmergencyContacts] = useState<boolean>(false);
  const [showSafetyReport, setShowSafetyReport] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showVehicleModal, setShowVehicleModal] = useState<boolean>(false);
  const [stripeSetupComplete, setStripeSetupComplete] = useState<boolean>(false);
  const [driverRideCount, setDriverRideCount] = useState<number>(0);
  const [showStripeAlert, setShowStripeAlert] = useState<boolean>(false);
  const [isLoadingStripe, setIsLoadingStripe] = useState<boolean>(false);
  const [editingProfile, setEditingProfile] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || ''
  });
  const [editingVehicle, setEditingVehicle] = useState({
    make: user?.carDetails?.make || '',
    model: user?.carDetails?.model || '',
    year: user?.carDetails?.year?.toString() || '',
    color: user?.carDetails?.color || '',
    licensePlate: user?.carDetails?.licensePlate || ''
  });
  const [uploadingProfilePicture, setUploadingProfilePicture] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState<boolean>(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState<boolean>(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');

  // Check driver status and Stripe setup on component mount
  useEffect(() => {
    const checkDriverStatus = async () => {
      if (user?.id && user?.role === 'driver') {
        try {
          // Check Stripe Connect setup status
          const isComplete = await StripeConnectService.isConnectSetupComplete(user.id);
          setStripeSetupComplete(isComplete);

          // Get driver's ride count
          const userRides = getUserRides(user.id, 'driver');
          const completedRides = userRides.filter(ride => ride.status === 'completed').length;
          setDriverRideCount(completedRides);

          // Show alert if driver has 10+ rides but no Stripe setup
          if (completedRides >= 10 && !isComplete) {
            setShowStripeAlert(true);
          }
        } catch (error) {
          console.error('Error checking driver status:', error);
        }
      }
    };

    checkDriverStatus();
    // Load settings on component mount
    loadSettings();

    // Check verification status
    const checkVerification = async () => {
      if (user) {
        const status = await VerificationService.checkVerificationStatus(user);
        setVerificationStatus(status);
      }
    };
    checkVerification();
  }, [user?.id, user?.role, getUserRides, loadSettings, user]);

  const handleStripeSetup = async () => {
    if (!user) return;

    try {
      setIsLoadingStripe(true);

      // Use direct Stripe Connect link (bypassing Cloud Function temporarily)
      const connectUrl = 'https://connect.stripe.com/d/setup/e/_TZqghrCURCjJsaKmu5JoRVsZrc/YWNjdF8xU2NnejBEMXRsSFRZMkJ6/9496cf1009ab1c95a';

      Alert.alert(
        '💳 Stripe Connect Setup',
        'You will be redirected to Stripe to set up your payment account. This is required to receive payments from riders.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue to Stripe',
            onPress: async () => {
              try {
                // Check if the URL can be opened
                const supported = await Linking.canOpenURL(connectUrl);
                if (supported) {
                  // Open Stripe Connect URL in browser
                  await Linking.openURL(connectUrl);

                  // Show instructions after opening
                  setTimeout(() => {
                    Alert.alert(
                      'ℹ️ Complete Setup',
                      'Please complete the Stripe onboarding in your browser. When finished, return to the app and refresh your profile to see the updated status.',
                      [{ text: 'OK' }]
                    );
                  }, 500);
                } else {
                  throw new Error('Cannot open Stripe URL');
                }
              } catch (error) {
                console.error('Error opening Stripe URL:', error);
                Alert.alert(
                  'Error',
                  'Failed to open Stripe Connect. Please try again or contact support if the issue persists.',
                  [{ text: 'OK' }]
                );
              }
            }
          }
        ]
      );
    } catch (error: unknown) {
      console.error('Error starting Stripe setup:', error);
      Alert.alert(
        'Setup Failed',
        'Unable to start Stripe setup. Please check your internet connection and try again.',
        [
          { text: 'Retry', onPress: handleStripeSetup },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } finally {
      setIsLoadingStripe(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/auth');
          }
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    // Open the GitHub-style Danger Zone modal
    setShowDeleteAccountModal(true);
    setDeleteConfirmText('');
  };

  const confirmDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      Alert.alert('Error', 'Please type DELETE to confirm account deletion.');
      return;
    }

    try {
      setIsDeletingAccount(true);
      await deleteAccount();
      setShowDeleteAccountModal(false);
      router.replace('/auth');
      Alert.alert('Account Deleted', 'Your account and all associated data have been permanently deleted.');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Deletion Failed', `Failed to delete account: ${errorMessage}\n\nPlease try again or contact support.`);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleEditProfile = () => {
    setEditingProfile({
      name: user?.name || '',
      phone: user?.phone || '',
      email: user?.email || ''
    });
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    try {
      await updateUser({
        name: editingProfile.name,
        phone: editingProfile.phone,
        email: editingProfile.email
      });
      setShowEditModal(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: unknown) {
      console.error('Update profile error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert(
        'Update Failed',
        `Unable to save your profile changes: ${errorMessage}\n\nPlease try again.`,
        [
          { text: 'Retry', onPress: handleSaveProfile },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const handleEditVehicle = () => {
    setEditingVehicle({
      make: user?.carDetails?.make || '',
      model: user?.carDetails?.model || '',
      year: user?.carDetails?.year?.toString() || '',
      color: user?.carDetails?.color || '',
      licensePlate: user?.carDetails?.licensePlate || ''
    });
    setShowVehicleModal(true);
  };

  const handleSaveVehicle = async () => {
    try {
      const vehicleData = {
        carDetails: {
          id: user?.carDetails?.id || `vehicle_${user?.id}`,
          make: editingVehicle.make,
          model: editingVehicle.model,
          year: parseInt(editingVehicle.year) || 2020,
          color: editingVehicle.color,
          licensePlate: editingVehicle.licensePlate,
          seats: user?.carDetails?.seats || 5,
          verified: user?.carDetails?.verified || false
        }
      };

      await updateUser(vehicleData);
      setShowVehicleModal(false);
      Alert.alert('Success', 'Vehicle details updated successfully!');
    } catch (error: unknown) {
      console.error('Update vehicle error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert(
        'Update Failed',
        `Unable to save vehicle details: ${errorMessage}\n\nPlease check your information and try again.`,
        [
          { text: 'Retry', onPress: handleSaveVehicle },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const handleSettings = () => {
    setShowSettingsModal(true);
  };

  const handleHelp = () => {
    setShowHelpModal(true);
  };

  const handleSafety = () => {
    setShowSafetyModal(true);
  };

  const handleProfilePictureUpload = () => {
    const options = [
      'Take Photo',
      'Choose from Library',
      'Cancel'
    ];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            uploadProfilePictureFromCamera();
          } else if (buttonIndex === 1) {
            uploadProfilePictureFromLibrary();
          }
        }
      );
    } else {
      Alert.alert(
        'Profile Picture',
        'Choose an option',
        [
          { text: 'Take Photo', onPress: uploadProfilePictureFromCamera },
          { text: 'Choose from Library', onPress: uploadProfilePictureFromLibrary },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const uploadProfilePictureFromCamera = async () => {
    try {
      setUploadingProfilePicture(true);
      const imageUri = await ImageService.takePhoto({ allowsEditing: true, aspect: [1, 1] });
      if (imageUri && user) {
        const downloadURL = await ImageService.uploadProfilePicture(user.id, imageUri);
        if (downloadURL) {
          await updateUser({ profilePicture: downloadURL });
          Alert.alert('Success', 'Profile picture updated successfully!');
        } else {
          Alert.alert('Error', 'Failed to upload profile picture');
        }
      }
    } catch (error: unknown) {
      console.error('Upload profile picture error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      Alert.alert(
        'Upload Failed',
        `Couldn't upload your photo: ${errorMessage}\n\nMake sure the image is less than 5MB and try again.`,
        [
          { text: 'Retry', onPress: uploadProfilePictureFromCamera },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } finally {
      setUploadingProfilePicture(false);
    }
  };

  const uploadProfilePictureFromLibrary = async () => {
    try {
      setUploadingProfilePicture(true);
      const imageUri = await ImageService.pickImage({ allowsEditing: true, aspect: [1, 1] });
      if (imageUri && user) {
        const downloadURL = await ImageService.uploadProfilePicture(user.id, imageUri);
        if (downloadURL) {
          await updateUser({ profilePicture: downloadURL });
          Alert.alert('Success', 'Profile picture updated successfully!');
        } else {
          Alert.alert('Error', 'Failed to upload profile picture');
        }
      }
    } catch (error: unknown) {
      console.error('Upload profile picture error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      Alert.alert(
        'Upload Failed',
        `Couldn't upload your photo: ${errorMessage}\n\nMake sure the image is less than 5MB and try again.`,
        [
          { text: 'Retry', onPress: uploadProfilePictureFromLibrary },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } finally {
      setUploadingProfilePicture(false);
    }
  };

  const handleDocumentUpload = (documentType: 'registration' | 'insurance') => {
    const options = [
      'Take Photo',
      'Choose from Library',
      'Cancel'
    ];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            uploadDocumentFromCamera(documentType);
          } else if (buttonIndex === 1) {
            uploadDocumentFromLibrary(documentType);
          }
        }
      );
    } else {
      Alert.alert(
        `Upload ${documentType === 'registration' ? 'Registration' : 'Insurance'} Document`,
        'Choose an option',
        [
          { text: 'Take Photo', onPress: () => uploadDocumentFromCamera(documentType) },
          { text: 'Choose from Library', onPress: () => uploadDocumentFromLibrary(documentType) },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const uploadDocumentFromCamera = async (documentType: 'registration' | 'insurance') => {
    try {
      setUploadingDocument(documentType);
      const imageUri = await ImageService.takePhoto({ allowsEditing: false });
      if (imageUri && user) {
        const downloadURL = await ImageService.uploadVehicleDocument(user.id, imageUri, documentType);
        if (downloadURL) {
          const updatedCarDetails = {
            id: user.carDetails?.id || `vehicle_${user.id}`,
            make: user.carDetails?.make || '',
            model: user.carDetails?.model || '',
            year: user.carDetails?.year || 2020,
            color: user.carDetails?.color || '',
            licensePlate: user.carDetails?.licensePlate || '',
            seats: user.carDetails?.seats || 5,
            verified: user.carDetails?.verified || false,
            ...user.carDetails,
            [documentType === 'registration' ? 'registrationDocument' : 'insuranceDocument']: downloadURL
          };
          await updateUser({ carDetails: updatedCarDetails });
          Alert.alert('Success', `${documentType === 'registration' ? 'Registration' : 'Insurance'} document uploaded successfully!`);
        } else {
          Alert.alert('Error', 'Failed to upload document');
        }
      }
    } catch (error: unknown) {
      console.error('Upload document error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      Alert.alert(
        'Document Upload Failed',
        `Couldn't upload your ${documentType} document: ${errorMessage}\n\nPlease ensure the image is clear and try again.`,
        [
          { text: 'Retry', onPress: () => uploadDocumentFromCamera(documentType) },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } finally {
      setUploadingDocument(null);
    }
  };

  const uploadDocumentFromLibrary = async (documentType: 'registration' | 'insurance') => {
    try {
      setUploadingDocument(documentType);
      const imageUri = await ImageService.pickImage({ allowsEditing: false });
      if (imageUri && user) {
        const downloadURL = await ImageService.uploadVehicleDocument(user.id, imageUri, documentType);
        if (downloadURL) {
          const updatedCarDetails = {
            id: user.carDetails?.id || `vehicle_${user.id}`,
            make: user.carDetails?.make || '',
            model: user.carDetails?.model || '',
            year: user.carDetails?.year || 2020,
            color: user.carDetails?.color || '',
            licensePlate: user.carDetails?.licensePlate || '',
            seats: user.carDetails?.seats || 5,
            verified: user.carDetails?.verified || false,
            ...user.carDetails,
            [documentType === 'registration' ? 'registrationDocument' : 'insuranceDocument']: downloadURL
          };
          await updateUser({ carDetails: updatedCarDetails });
          Alert.alert('Success', `${documentType === 'registration' ? 'Registration' : 'Insurance'} document uploaded successfully!`);
        } else {
          Alert.alert('Error', 'Failed to upload document');
        }
      }
    } catch (error: unknown) {
      console.error('Upload document error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      Alert.alert(
        'Document Upload Failed',
        `Couldn't upload your ${documentType} document: ${errorMessage}\n\nPlease ensure the image is clear and try again.`,
        [
          { text: 'Retry', onPress: () => uploadDocumentFromLibrary(documentType) },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } finally {
      setUploadingDocument(null);
    }
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contact Support',
      'Choose how you\'d like to contact us:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Email',
          onPress: () => Linking.openURL('mailto:support@carpoolconnect.com')
        },
        {
          text: 'Phone',
          onPress: () => Linking.openURL('tel:+1234567890')
        },
      ]
    );
  };

  const menuItems = [
    {
      icon: Settings,
      title: 'Settings',
      subtitle: 'App preferences and notifications',
      onPress: handleSettings,
    },
    {
      icon: HelpCircle,
      title: 'Help & Support',
      subtitle: 'Get help and contact support',
      onPress: handleHelp,
    },
    {
      icon: Shield,
      title: 'Safety',
      subtitle: 'Safety features and emergency contacts',
      onPress: handleSafety,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#667eea', '#764ba2', '#f093fb']}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Profile</Text>
            <NotificationBell />
          </View>
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <TouchableOpacity
                style={styles.avatar}
                onPress={handleProfilePictureUpload}
                disabled={uploadingProfilePicture}
              >
                {user?.profilePicture ? (
                  <Image
                    source={{ uri: user.profilePicture }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.avatarText}>
                    {user?.name?.charAt(0) || 'U'}
                  </Text>
                )}
                {uploadingProfilePicture && (
                  <View style={styles.uploadingOverlay}>
                    <Text style={styles.uploadingText}>Uploading...</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={handleProfilePictureUpload}
                disabled={uploadingProfilePicture}
              >
                <Camera size={16} color={Colors.background} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editButton}
                onPress={handleEditProfile}
              >
                <Edit size={16} color="#667eea" />
              </TouchableOpacity>
            </View>

            <View style={styles.userNameRow}>
              <Text style={styles.userName}>{user?.name}</Text>
              {user && <VerificationBadge user={user} size="medium" />}
            </View>
            <View style={styles.roleContainer}>
              {user?.role === 'driver' ? (
                <Car size={16} color={Colors.background} />
              ) : (
                <Users size={16} color={Colors.background} />
              )}
              <Text style={styles.userRole}>
                {user?.role === 'driver' ? 'Driver' : 'Rider'}
              </Text>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Star size={20} color={Colors.background} fill={Colors.background} />
                <Text style={styles.statValue}>{user?.rating}</Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Calendar size={20} color={Colors.background} />
                <Text style={styles.statValue}>{user?.totalRides}</Text>
                <Text style={styles.statLabel}>Rides</Text>
              </View>
              <View style={styles.statDivider} />
              <TouchableOpacity
                style={styles.statItem}
                onPress={() => setShowVerificationModal(true)}
                activeOpacity={0.7}
              >
                <Shield size={20} color={Colors.background} />
                <Text style={[styles.statValue, { fontSize: 18 }]} numberOfLines={1}>
                  {verificationStatus?.verificationLevel === 'premium' ? '✓' : '✗'}
                </Text>
                <Text style={styles.statLabel}>Verified</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Stripe Payment Setup Alert for Drivers */}
          {user?.role === 'driver' && showStripeAlert && (
            <Card style={styles.alertCard}>
              <View style={styles.alertHeader}>
                <AlertTriangle size={24} color={Colors.warning} />
                <Text style={styles.alertTitle}>Payment Setup Required</Text>
              </View>
              <Text style={styles.alertMessage}>
                You&apos;ve completed {driverRideCount} rides! To continue offering rides and receive payments, please set up your Stripe Connect account.
              </Text>
              <View style={styles.alertActions}>
                <Button
                  title="Set Up Payments"
                  onPress={handleStripeSetup}
                  style={styles.alertButton}
                  leftIcon={<CreditCard size={16} color={Colors.background} />}
                  disabled={isLoadingStripe}
                />
                <TouchableOpacity
                  style={styles.dismissButton}
                  onPress={() => setShowStripeAlert(false)}
                >
                  <Text style={styles.dismissText}>Remind me later</Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}

          {/* Stripe Status Card for Drivers */}
          {user?.role === 'driver' && (
            <Card style={styles.stripeCard}>
              <View style={styles.stripeHeader}>
                <CreditCard size={24} color={stripeSetupComplete ? Colors.success : Colors.textSecondary} />
                <View style={styles.stripeInfo}>
                  <Text style={styles.stripeTitle}>Payment Setup</Text>
                  <Text style={[styles.stripeStatus, stripeSetupComplete && styles.stripeStatusComplete]}>
                    {stripeSetupComplete ? 'Complete' : 'Not Set Up'}
                  </Text>
                </View>
                {stripeSetupComplete ? (
                  <CheckCircle size={20} color={Colors.success} />
                ) : (
                  <TouchableOpacity
                    style={styles.setupButton}
                    onPress={handleStripeSetup}
                    disabled={isLoadingStripe}
                  >
                    <Text style={styles.setupButtonText}>
                      {isLoadingStripe ? 'Loading...' : 'Set Up'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.stripeDescription}>
                {stripeSetupComplete
                  ? 'Your Stripe Connect account is set up. You can receive payments from riders.'
                  : `Complete ${Math.max(0, 10 - driverRideCount)} more rides to require payment setup, or set up now to start earning.`
                }
              </Text>
            </Card>
          )}

          {/* Identity Verification Card */}
          <Card style={styles.stripeCard}>
            <View style={styles.stripeHeader}>
              <Shield size={24} color={user?.verification?.status === 'verified' ? Colors.success : Colors.textSecondary} />
              <View style={styles.stripeInfo}>
                <Text style={styles.stripeTitle}>Identity Verification</Text>
                <Text style={[styles.stripeStatus, user?.verification?.status === 'verified' && styles.stripeStatusComplete]}>
                  {user?.verification?.status === 'verified' ? 'Verified' :
                    user?.verification?.status === 'pending' ? 'Pending' : 'Not Verified'}
                </Text>
              </View>
              {user?.verification?.status === 'verified' ? (
                <CheckCircle size={20} color={Colors.success} />
              ) : (
                <TouchableOpacity
                  style={styles.setupButton}
                  onPress={() => router.push('/verify-identity')}
                >
                  <Text style={styles.setupButtonText}>
                    {user?.verification?.status === 'pending' ? 'Check Status' : 'Verify Now'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.stripeDescription}>
              {user?.verification?.status === 'verified'
                ? 'Your identity is verified. You can post rides and access all features.'
                : user?.role === 'driver'
                  ? 'Verify your identity to post rides and build trust with riders.'
                  : 'Get verified to access premium features and build trust in the community.'}
            </Text>
          </Card>

          <Card style={styles.infoCard}>
            <Text style={styles.cardTitle}>Contact Information</Text>
            <View style={styles.infoItem}>
              <Mail size={20} color={Colors.textSecondary} />
              <Text style={styles.infoText}>{user?.email}</Text>
            </View>
            <View style={styles.infoItem}>
              <Phone size={20} color={Colors.textSecondary} />
              <Text style={styles.infoText}>{user?.phone}</Text>
            </View>
            <View style={styles.infoItem}>
              <Calendar size={20} color={Colors.textSecondary} />
              <Text style={styles.infoText}>
                Member since {new Date(user?.joinedDate || '').toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric'
                })}
              </Text>
            </View>
          </Card>

          {user?.role === 'driver' && (
            <Card style={styles.vehicleCard}>
              <Text style={styles.cardTitle}>Vehicle Information</Text>
              <View style={styles.vehicleInfo}>
                <Car size={24} color={Colors.primary} />
                <View style={styles.vehicleDetails}>
                  <Text style={styles.vehicleText}>
                    {user?.carDetails ?
                      `${user.carDetails.make} ${user.carDetails.model} ${user.carDetails.year}` :
                      'No vehicle information'
                    }
                  </Text>
                  <Text style={styles.vehicleSubtext}>
                    {user?.carDetails ?
                      `${user.carDetails.color} • ${user.carDetails.licensePlate}` :
                      'Add your vehicle details'
                    }
                  </Text>
                </View>
              </View>

              <View style={styles.documentSection}>
                <Text style={styles.documentTitle}>Documents</Text>

                {/* Show lock warning if documents are locked */}
                {user?.driverApproval?.documentsLocked && (
                  <View style={[styles.approvalStatusBox, { backgroundColor: '#FEF3C7', marginBottom: 12 }]}>
                    <Lock size={16} color="#D97706" />
                    <Text style={[styles.approvalStatusText, { color: '#D97706', flex: 1 }]}>
                      Documents locked. Contact admin to update.
                    </Text>
                  </View>
                )}

                {/* Show expiry warning if approaching */}
                {user?.driverApproval?.expiryDate && (() => {
                  const expiry = new Date(user.driverApproval.expiryDate);
                  const now = new Date();
                  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
                    return (
                      <View style={[styles.approvalStatusBox, { backgroundColor: '#FEF3C7', marginBottom: 12 }]}>
                        <AlertTriangle size={16} color="#D97706" />
                        <Text style={[styles.approvalStatusText, { color: '#D97706', flex: 1 }]}>
                          Documents expire in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}. Contact admin to update.
                        </Text>
                      </View>
                    );
                  }
                  if (daysUntilExpiry <= 0) {
                    return (
                      <View style={[styles.approvalStatusBox, { backgroundColor: '#FEE2E2', marginBottom: 12 }]}>
                        <AlertTriangle size={16} color="#DC2626" />
                        <Text style={[styles.approvalStatusText, { color: '#DC2626', flex: 1 }]}>
                          Documents expired. Contact admin to renew and continue posting rides.
                        </Text>
                      </View>
                    );
                  }
                  return null;
                })()}

                <View style={styles.documentRow}>
                  <View style={styles.documentItem}>
                    <File size={16} color={Colors.textSecondary} />
                    <Text style={styles.documentLabel}>Registration</Text>
                    <TouchableOpacity
                      style={[
                        styles.documentButton,
                        user?.carDetails?.registrationDocument && styles.documentButtonUploaded,
                        user?.driverApproval?.documentsLocked && { opacity: 0.5 }
                      ]}
                      onPress={() => handleDocumentUpload('registration')}
                      disabled={uploadingDocument === 'registration' || user?.driverApproval?.documentsLocked}
                    >
                      {uploadingDocument === 'registration' ? (
                        <Text style={styles.documentButtonText}>Uploading...</Text>
                      ) : user?.driverApproval?.documentsLocked ? (
                        <>
                          <Lock size={14} color={Colors.textSecondary} />
                          <Text style={styles.documentButtonText}>Locked</Text>
                        </>
                      ) : (
                        <>
                          <Upload size={14} color={user?.carDetails?.registrationDocument ? Colors.background : Colors.primary} />
                          <Text style={[
                            styles.documentButtonText,
                            user?.carDetails?.registrationDocument && styles.documentButtonTextUploaded
                          ]}>
                            {user?.carDetails?.registrationDocument ? 'Uploaded' : 'Upload'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.documentItem}>
                    <File size={16} color={Colors.textSecondary} />
                    <Text style={styles.documentLabel}>Insurance</Text>
                    <TouchableOpacity
                      style={[
                        styles.documentButton,
                        user?.carDetails?.insuranceDocument && styles.documentButtonUploaded,
                        user?.driverApproval?.documentsLocked && { opacity: 0.5 }
                      ]}
                      onPress={() => handleDocumentUpload('insurance')}
                      disabled={uploadingDocument === 'insurance' || user?.driverApproval?.documentsLocked}
                    >
                      {uploadingDocument === 'insurance' ? (
                        <Text style={styles.documentButtonText}>Uploading...</Text>
                      ) : user?.driverApproval?.documentsLocked ? (
                        <>
                          <Lock size={14} color={Colors.textSecondary} />
                          <Text style={styles.documentButtonText}>Locked</Text>
                        </>
                      ) : (
                        <>
                          <Upload size={14} color={user?.carDetails?.insuranceDocument ? Colors.background : Colors.primary} />
                          <Text style={[
                            styles.documentButtonText,
                            user?.carDetails?.insuranceDocument && styles.documentButtonTextUploaded
                          ]}>
                            {user?.carDetails?.insuranceDocument ? 'Uploaded' : 'Upload'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <Button
                title="Manage Vehicle"
                variant="outline"
                size="small"
                onPress={handleEditVehicle}
              />

              {/* Driver Approval Status */}
              {user?.carDetails?.make && user?.carDetails?.registrationDocument && user?.carDetails?.insuranceDocument && (
                <View style={styles.approvalSection}>
                  <Text style={styles.documentTitle}>Driver Approval Status</Text>
                  {!user?.driverApproval || user?.driverApproval?.status === 'not_submitted' ? (
                    <View>
                      <Text style={styles.approvalText}>
                        Your documents are ready for review. Submit for admin approval to start posting rides.
                      </Text>
                      <Button
                        title="Submit for Approval"
                        onPress={async () => {
                          try {
                            await updateUser({
                              driverApproval: {
                                status: 'pending',
                                submittedAt: new Date().toISOString(),
                              }
                            });
                            Alert.alert('Success', 'Your driver application has been submitted for review. We\'ll notify you once approved.');
                          } catch {
                            Alert.alert('Error', 'Failed to submit for approval. Please try again.');
                          }
                        }}
                        style={styles.approvalButton}
                      />
                    </View>
                  ) : user?.driverApproval?.status === 'pending' ? (
                    <View style={styles.approvalStatusBox}>
                      <Clock size={20} color={Colors.warning} />
                      <Text style={[styles.approvalStatusText, { color: Colors.warning }]}>
                        Pending Review - Your application is under review
                      </Text>
                    </View>
                  ) : user?.driverApproval?.status === 'approved' ? (
                    <View style={styles.approvalStatusBox}>
                      <CheckCircle size={20} color={Colors.success} />
                      <Text style={[styles.approvalStatusText, { color: Colors.success }]}>
                        Approved - You can post rides
                      </Text>
                    </View>
                  ) : user?.driverApproval?.status === 'rejected' ? (
                    <View>
                      <View style={styles.approvalStatusBox}>
                        <AlertTriangle size={20} color={Colors.error} />
                        <Text style={[styles.approvalStatusText, { color: Colors.error }]}>
                          Rejected: {user?.driverApproval?.rejectionReason || 'Contact support for details'}
                        </Text>
                      </View>
                      <Button
                        title="Resubmit for Approval"
                        onPress={async () => {
                          try {
                            await updateUser({
                              driverApproval: {
                                status: 'pending',
                                submittedAt: new Date().toISOString(),
                              }
                            });
                            Alert.alert('Success', 'Your application has been resubmitted for review.');
                          } catch {
                            Alert.alert('Error', 'Failed to resubmit. Please try again.');
                          }
                        }}
                        style={[styles.approvalButton, { marginTop: 12 }]}
                      />
                    </View>
                  ) : null}
                </View>
              )}
            </Card>
          )}

          <View style={styles.menuSection}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuItem}
                onPress={item.onPress}
                activeOpacity={0.8}
              >
                <View style={styles.menuIcon}>
                  <item.icon size={28} color="#667eea" />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <Button
            title="Logout"
            onPress={handleLogout}
            variant="outline"
            style={styles.logoutButton}
            textStyle={styles.logoutText}
          />

          <TouchableOpacity
            style={styles.deleteAccountButton}
            onPress={handleDeleteAccount}
            disabled={isDeletingAccount}
            activeOpacity={0.7}
          >
            <Trash2 size={18} color="#DC2626" />
            <Text style={styles.deleteAccountText}>
              {isDeletingAccount ? 'Deleting Account...' : 'Delete Account'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Settings Screen */}
      <SettingsScreen
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* Help Modal */}
      <Modal
        visible={showHelpModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowHelpModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Help & Support</Text>
            <TouchableOpacity
              onPress={() => setShowHelpModal(false)}
              style={styles.closeButton}
            >
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <TouchableOpacity style={styles.helpItem} onPress={handleContactSupport}>
              <MessageCircle size={20} color={Colors.primary} />
              <View style={styles.helpContent}>
                <Text style={styles.helpTitle}>Contact Support</Text>
                <Text style={styles.helpSubtitle}>Get help from our support team</Text>
              </View>
              <ExternalLink size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.helpItem}
              onPress={() => {
                setInfoModalTitle('FAQ');
                setInfoModalContent(FAQ);
                setShowInfoModal(true);
              }}
            >
              <HelpCircle size={20} color={Colors.primary} />
              <View style={styles.helpContent}>
                <Text style={styles.helpTitle}>FAQ</Text>
                <Text style={styles.helpSubtitle}>Frequently asked questions</Text>
              </View>
              <ExternalLink size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.helpItem}
              onPress={() => {
                setInfoModalTitle('Terms of Service');
                setInfoModalContent(TERMS_OF_SERVICE);
                setShowInfoModal(true);
              }}
            >
              <FileText size={20} color={Colors.primary} />
              <View style={styles.helpContent}>
                <Text style={styles.helpTitle}>Terms of Service</Text>
                <Text style={styles.helpSubtitle}>Read our terms and conditions</Text>
              </View>
              <ExternalLink size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.helpItem}
              onPress={() => {
                setInfoModalTitle('Privacy Policy');
                setInfoModalContent(PRIVACY_POLICY);
                setShowInfoModal(true);
              }}
            >
              <Lock size={20} color={Colors.primary} />
              <View style={styles.helpContent}>
                <Text style={styles.helpTitle}>Privacy Policy</Text>
                <Text style={styles.helpSubtitle}>How we handle your data</Text>
              </View>
              <ExternalLink size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Safety Modal */}
      <Modal
        visible={showSafetyModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowSafetyModal(false);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Safety</Text>
            <TouchableOpacity
              onPress={() => {
                setShowSafetyModal(false);
              }}
              style={styles.closeButton}
            >
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 50 }}
          >
            <View style={styles.safetySection}>
              <Text style={styles.sectionTitle}>Emergency Contacts</Text>
              <Text style={styles.safetyText}>
                Add emergency contacts who will be notified in case of an emergency during your ride.
              </Text>
              <TouchableOpacity
                style={styles.safetyActionButton}
                onPress={() => {
                  setShowSafetyModal(false);
                  setTimeout(() => setShowEmergencyContacts(true), 300);
                }}
              >
                <Users size={20} color={Colors.primary} />
                <Text style={styles.safetyActionText}>Manage Emergency Contacts</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.safetySection}>
              <Text style={styles.sectionTitle}>Report Safety Issue</Text>
              <Text style={styles.safetyText}>
                If you experienced any safety concerns during a ride, please report it immediately.
              </Text>
              <TouchableOpacity
                style={[styles.safetyActionButton, styles.reportButton]}
                onPress={() => {
                  setShowSafetyModal(false);
                  setTimeout(() => setShowSafetyReport(true), 300);
                }}
              >
                <AlertTriangle size={20} color={Colors.background} />
                <Text style={[styles.safetyActionText, styles.reportButtonText]}>Report Safety Issue</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.safetySection}>
              <Text style={styles.sectionTitle}>Safety Features</Text>
              <Text style={styles.safetyText}>
                • Real-time ride tracking{"\n"}• Share trip details with contacts{"\n"}• In-app emergency button{"\n"}• Driver and rider verification
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Danger Zone: Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteAccountModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDeleteAccountModal(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.dangerZoneOverlay}>
            <View style={styles.dangerZoneModal}>
              <View style={styles.dangerZoneHeader}>
                <AlertTriangle size={32} color="#DC2626" />
                <Text style={styles.dangerZoneTitle}>Danger Zone</Text>
              </View>

              <View style={styles.dangerZoneWarning}>
                <Text style={styles.dangerZoneWarningText}>
                  ⚠️ This action is permanent and cannot be undone.
                </Text>
              </View>

              <Text style={styles.dangerZoneDescription}>
                Deleting your account will permanently remove:
              </Text>
              <View style={styles.dangerZoneList}>
                <Text style={styles.dangerZoneListItem}>• All your personal information</Text>
                <Text style={styles.dangerZoneListItem}>• Your ride history and bookings</Text>
                <Text style={styles.dangerZoneListItem}>• Your driver profile and documents</Text>
                <Text style={styles.dangerZoneListItem}>• Your payment and earnings history</Text>
                <Text style={styles.dangerZoneListItem}>• All ratings and reviews</Text>
              </View>

              <Text style={styles.dangerZoneConfirmLabel}>
                To confirm, type <Text style={styles.dangerZoneDeleteWord}>DELETE</Text> below:
              </Text>
              <Input
                placeholder="Type DELETE to confirm"
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                style={styles.dangerZoneInput}
                autoCapitalize="characters"
              />

              <View style={styles.dangerZoneButtons}>
                <TouchableOpacity
                  style={styles.dangerZoneCancelButton}
                  onPress={() => {
                    setShowDeleteAccountModal(false);
                    setDeleteConfirmText('');
                  }}
                >
                  <Text style={styles.dangerZoneCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.dangerZoneDeleteButton,
                    deleteConfirmText !== 'DELETE' && styles.dangerZoneDeleteButtonDisabled
                  ]}
                  onPress={confirmDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || isDeletingAccount}
                >
                  <Trash2 size={18} color="#FFFFFF" />
                  <Text style={styles.dangerZoneDeleteText}>
                    {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                style={styles.modalAction}
              >
                <X size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveProfile}
                style={styles.modalAction}
              >
                <Save size={24} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView style={styles.modalContent}>
            <Input
              label="Full Name"
              value={editingProfile.name}
              onChangeText={(text) => setEditingProfile(prev => ({ ...prev, name: text }))}
              placeholder="Enter your full name"
            />

            <Input
              label="Phone Number"
              value={editingProfile.phone}
              onChangeText={(text) => setEditingProfile(prev => ({ ...prev, phone: text }))}
              placeholder="Enter your phone number"
              keyboardType="phone-pad"
            />

            <Input
              label="Email Address"
              value={editingProfile.email}
              onChangeText={(text) => setEditingProfile(prev => ({ ...prev, email: text }))}
              placeholder="Enter your email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Vehicle Modal */}
      <Modal
        visible={showVehicleModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowVehicleModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Vehicle</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowVehicleModal(false)}
                style={styles.modalAction}
              >
                <X size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveVehicle}
                style={styles.modalAction}
              >
                <Save size={24} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView style={styles.modalContent}>
            <Input
              label="Make"
              value={editingVehicle.make}
              onChangeText={(text) => setEditingVehicle(prev => ({ ...prev, make: text }))}
              placeholder="e.g., Toyota"
            />

            <Input
              label="Model"
              value={editingVehicle.model}
              onChangeText={(text) => setEditingVehicle(prev => ({ ...prev, model: text }))}
              placeholder="e.g., Camry"
            />

            <Input
              label="Year"
              value={editingVehicle.year}
              onChangeText={(text) => setEditingVehicle(prev => ({ ...prev, year: text }))}
              placeholder="e.g., 2020"
              keyboardType="numeric"
            />

            <Input
              label="Color"
              value={editingVehicle.color}
              onChangeText={(text) => setEditingVehicle(prev => ({ ...prev, color: text }))}
              placeholder="e.g., Silver"
            />

            <Input
              label="License Plate"
              value={editingVehicle.licensePlate}
              onChangeText={(text) => setEditingVehicle(prev => ({ ...prev, licensePlate: text }))}
              placeholder="e.g., ABC-123"
              autoCapitalize="characters"
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Emergency Contacts Modal */}
      <EmergencyContactComponent
        isVisible={showEmergencyContacts}
        onClose={() => setShowEmergencyContacts(false)}
        isModal={true}
      />

      {/* Safety Report Modal */}
      <SafetyReportComponent
        isVisible={showSafetyReport}
        onClose={() => setShowSafetyReport(false)}
      />

      {/* Verification Status Modal */}
      <Modal
        visible={showVerificationModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowVerificationModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Verification Status</Text>
            <TouchableOpacity
              onPress={() => setShowVerificationModal(false)}
              style={styles.closeButton}
            >
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <View style={styles.verificationHeader}>
              {user && <VerificationBadge user={user} size="large" showLabel />}
              <Text style={styles.verificationLevel}>
                {verificationStatus?.verificationLevel === 'premium' ? 'Verified User' : 'Not Verified'}
              </Text>
            </View>

            <View style={styles.verificationSection}>
              <Text style={styles.sectionTitle}>Verification Criteria</Text>

              <View style={styles.criteriaList}>
                <View style={styles.criteriaItem}>
                  <View style={[styles.criteriaIcon, verificationStatus?.criteria.emailVerified && styles.criteriaIconComplete]}>
                    {verificationStatus?.criteria.emailVerified ? (
                      <CheckCircle size={20} color={Colors.success} />
                    ) : (
                      <X size={20} color={Colors.error} />
                    )}
                  </View>
                  <Text style={styles.criteriaText}>Email Verified</Text>
                </View>

                <View style={styles.criteriaItem}>
                  <View style={[styles.criteriaIcon, verificationStatus?.criteria.phoneVerified && styles.criteriaIconComplete]}>
                    {verificationStatus?.criteria.phoneVerified ? (
                      <CheckCircle size={20} color={Colors.success} />
                    ) : (
                      <X size={20} color={Colors.error} />
                    )}
                  </View>
                  <Text style={styles.criteriaText}>Phone Verified</Text>
                </View>

                <View style={styles.criteriaItem}>
                  <View style={[styles.criteriaIcon, verificationStatus?.criteria.profileComplete && styles.criteriaIconComplete]}>
                    {verificationStatus?.criteria.profileComplete ? (
                      <CheckCircle size={20} color={Colors.success} />
                    ) : (
                      <X size={20} color={Colors.error} />
                    )}
                  </View>
                  <Text style={styles.criteriaText}>Profile Complete</Text>
                </View>

                {user?.role === 'driver' && (
                  <View style={styles.criteriaItem}>
                    <View style={[styles.criteriaIcon, verificationStatus?.criteria.documentsUploaded && styles.criteriaIconComplete]}>
                      {verificationStatus?.criteria.documentsUploaded ? (
                        <CheckCircle size={20} color={Colors.success} />
                      ) : (
                        <X size={20} color={Colors.error} />
                      )}
                    </View>
                    <Text style={styles.criteriaText}>Vehicle Documents Uploaded</Text>
                  </View>
                )}



                {user?.role === 'driver' && (
                  <View style={styles.criteriaItem}>
                    <View style={[styles.criteriaIcon, verificationStatus?.criteria.stripeConnected && styles.criteriaIconComplete]}>
                      {verificationStatus?.criteria.stripeConnected ? (
                        <CheckCircle size={20} color={Colors.success} />
                      ) : (
                        <X size={20} color={Colors.error} />
                      )}
                    </View>
                    <Text style={styles.criteriaText}>Stripe Account Connected</Text>
                  </View>
                )}
              </View>
            </View>

            {verificationStatus && verificationStatus.missingCriteria.length > 0 && (
              <View style={styles.verificationSection}>
                <Text style={styles.sectionTitle}>What You Need</Text>
                <View style={styles.missingCriteriaList}>
                  {verificationStatus.missingCriteria.map((criteria, index) => (
                    <View key={index} style={styles.missingCriteriaItem}>
                      <AlertTriangle size={16} color={Colors.warning} />
                      <Text style={styles.missingCriteriaText}>{criteria}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.verificationSection}>
              <Text style={styles.sectionTitle}>Verification Levels</Text>
              <View style={styles.levelsList}>
                <View style={styles.levelItem}>
                  <View style={[styles.levelBadge, { backgroundColor: '#9E9E9E' }]} />
                  <View style={styles.levelContent}>
                    <Text style={styles.levelTitle}>Not Verified</Text>
                    <Text style={styles.levelDescription}>Basic account with limited verification</Text>
                  </View>
                </View>
                <View style={styles.levelItem}>
                  <View style={[styles.levelBadge, { backgroundColor: '#FFD700' }]} />
                  <View style={styles.levelContent}>
                    <Text style={styles.levelTitle}>Verified</Text>
                    <Text style={styles.levelDescription}>Email, phone, and profile verified with documents (for drivers)</Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      {/* Legal Info Modal */}
      <Modal
        visible={showInfoModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{infoModalTitle}</Text>
            <TouchableOpacity
              onPress={() => setShowInfoModal(false)}
              style={styles.closeButton}
            >
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={{ fontSize: 16, lineHeight: 24, color: Colors.text, paddingHorizontal: 4 }}>
              {infoModalContent}
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '700' as const,
    color: '#667eea',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  editButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  userName: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  userRole: {
    fontSize: 18,
    color: '#FFFFFF',
    marginLeft: 8,
    fontWeight: '600' as const,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 32,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginTop: 8,
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500' as const,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  content: {
    padding: 24,
  },
  infoCard: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.1)',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#2D3748',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: '#4A5568',
    marginLeft: 12,
    fontWeight: '500' as const,
  },
  vehicleCard: {
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.1)',
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  vehicleDetails: {
    marginLeft: 12,
    flex: 1,
  },
  vehicleText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#2D3748',
    marginBottom: 2,
  },
  vehicleSubtext: {
    fontSize: 16,
    color: '#4A5568',
    fontWeight: '500' as const,
  },
  menuSection: {
    marginBottom: 32,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.1)',
  },
  menuIcon: {
    marginRight: 16,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#2D3748',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 15,
    color: '#4A5568',
    fontWeight: '500' as const,
  },
  logoutButton: {
    borderColor: Colors.error,
    marginBottom: 32,
  },
  logoutText: {
    color: Colors.error,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
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
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },

  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 12,
  },
  helpContent: {
    flex: 1,
    marginLeft: 12,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  helpSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  safetySection: {
    marginBottom: 24,
  },
  safetyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  safetyButton: {
    marginTop: 8,
  },
  safetyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
    marginTop: 12,
    gap: 8,
  },
  safetyActionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  reportButton: {
    backgroundColor: Colors.error,
    borderColor: Colors.error,
  },
  reportButtonText: {
    color: Colors.background,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 16,
  },
  modalAction: {
    padding: 4,
  },
  documentSection: {
    marginTop: 16,
    marginBottom: 16,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  documentRow: {
    gap: 12,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  documentLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 8,
    flex: 1,
  },
  documentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
    gap: 4,
  },
  documentButtonUploaded: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  documentButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  documentButtonTextUploaded: {
    color: Colors.background,
  },
  alertCard: {
    marginBottom: 20,
    backgroundColor: '#FFF8E1',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 6,
    borderLeftColor: '#F59E0B',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#2D3748',
    marginLeft: 12,
  },
  alertMessage: {
    fontSize: 16,
    color: '#4A5568',
    lineHeight: 24,
    marginBottom: 16,
    fontWeight: '500' as const,
  },
  alertActions: {
    gap: 8,
  },
  alertButton: {
    backgroundColor: Colors.warning,
  },
  dismissButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  stripeCard: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.1)',
  },
  stripeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stripeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  stripeTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#2D3748',
    marginBottom: 2,
  },
  stripeStatus: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  stripeStatusComplete: {
    color: Colors.success,
    fontWeight: '500' as const,
  },
  setupButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  setupButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  stripeDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  nestedModalContainer: {
    flex: 1,
  },
  backToSafetyButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  backToSafetyText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  verificationHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 24,
  },
  verificationLevel: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 12,
  },
  verificationSection: {
    marginBottom: 24,
  },
  criteriaList: {
    gap: 12,
  },
  criteriaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    gap: 12,
  },
  criteriaIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  criteriaIconComplete: {
    backgroundColor: Colors.success + '20',
  },
  criteriaText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
    flex: 1,
  },
  missingCriteriaList: {
    gap: 8,
  },
  missingCriteriaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.warning + '10',
    borderRadius: 8,
    gap: 8,
  },
  missingCriteriaText: {
    fontSize: 13,
    color: Colors.text,
    flex: 1,
  },
  levelsList: {
    gap: 12,
  },
  levelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    gap: 12,
  },
  levelBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  levelContent: {
    flex: 1,
  },
  levelTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  levelDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 12,
    marginBottom: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DC2626',
    backgroundColor: 'rgba(220, 38, 38, 0.05)',
  },
  deleteAccountText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#DC2626',
  },
  approvalSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  approvalText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  approvalButton: {
    marginTop: 8,
  },
  approvalStatusBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    padding: 12,
    backgroundColor: Colors.surface,
    borderRadius: 8,
  },
  approvalStatusText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  // Danger Zone styles for delete account modal
  dangerZoneOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 20,
  },
  dangerZoneModal: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: '#DC2626',
  },
  dangerZoneHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 16,
  },
  dangerZoneTitle: {
    fontSize: 22,
    fontWeight: 'bold' as const,
    color: '#DC2626',
  },
  dangerZoneWarning: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  dangerZoneWarningText: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  dangerZoneDescription: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 8,
    fontWeight: '500' as const,
  },
  dangerZoneList: {
    marginBottom: 16,
    paddingLeft: 8,
  },
  dangerZoneListItem: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  dangerZoneConfirmLabel: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 8,
  },
  dangerZoneDeleteWord: {
    fontWeight: 'bold' as const,
    color: '#DC2626',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  dangerZoneInput: {
    marginBottom: 20,
    borderColor: '#DC2626',
  },
  dangerZoneButtons: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  dangerZoneCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
  },
  dangerZoneCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  dangerZoneDeleteButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  },
  dangerZoneDeleteButtonDisabled: {
    backgroundColor: '#F87171',
    opacity: 0.6,
  },
  dangerZoneDeleteText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});