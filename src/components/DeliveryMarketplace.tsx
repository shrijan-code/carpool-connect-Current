import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Package, 
  Plus, 
  Clock, 
  DollarSign, 
  Truck, 
  CheckCircle,
  X,
  Trash2,
  Search,
  Info,
} from 'lucide-react-native';
import { useAuthStore } from '@/store/auth-store';
import { DeliveryItem, Delivery, Location, Ride } from '@/types';
import { DeliveryService, CreateDeliveryV2Request } from '@/services/delivery';
import { PlacesAutocomplete } from '@/components/PlacesAutocomplete';

const formatCurrency = (amount: number) => `${amount.toFixed(2)}`;
const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();
const formatTime = (dateString: string) => new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

interface DeliveryMarketplaceProps {
  onClose?: () => void;
  autoOpenCreate?: boolean;
}

interface DeliveryRequest {
  id?: string;
  businessId: string;
  items: DeliveryItem[];
  pickupAddress: string;
  dropoffAddress: string;
  pickupLocation?: Location;
  dropoffLocation?: Location;
  packageSize: 'small' | 'medium' | 'large' | 'extra_large';
  specialInstructions: string;
  priceCents: number;
  preferredTimeWindow: {
    start: string;
    end: string;
  };
  status: 'pending' | 'matched' | 'confirmed' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  matchedRideId?: string;
  createdAt: string;
}

const PACKAGE_SIZES = [
  { value: 'small', label: 'Small', description: 'Fits in a bag (< 5kg)', price: 500 },
  { value: 'medium', label: 'Medium', description: 'Fits in car seat (5-15kg)', price: 800 },
  { value: 'large', label: 'Large', description: 'Fits in trunk (15-30kg)', price: 1200 },
  { value: 'extra_large', label: 'Extra Large', description: 'Requires special handling (30kg+)', price: 1800 },
] as const;

const PRESET_AMOUNTS = [500, 800, 1200] as const;
const MAX_CUSTOM_AMOUNT_CENTS = 10000 as const;

export const DeliveryMarketplace: React.FC<DeliveryMarketplaceProps> = ({ onClose, autoOpenCreate }) => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'browse' | 'create' | 'manage'>('browse');
  const [deliveryRequests, setDeliveryRequests] = useState<DeliveryRequest[]>([]);
  const [availableRides, setAvailableRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const initNewDelivery = (): Partial<DeliveryRequest> => {
    const initialItem: DeliveryItem = {
      itemId: Date.now().toString(),
      name: '',
      quantity: 1,
    };
    return {
      items: [initialItem],
      pickupAddress: '',
      dropoffAddress: '',
      pickupLocation: undefined,
      dropoffLocation: undefined,
      packageSize: 'small',
      specialInstructions: '',
      priceCents: 500,
      preferredTimeWindow: { start: '', end: '' },
    };
  };

  const [newDelivery, setNewDelivery] = useState<Partial<DeliveryRequest>>(initNewDelivery);

  const [useCustomAmount, setUseCustomAmount] = useState<boolean>(false);
  const [customAmountInput, setCustomAmountInput] = useState<string>('');
  const [amountError, setAmountError] = useState<string>('');
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({});

  // Define resetForm function without useCallback to avoid initialization issues
  const resetForm = () => {
    const freshDelivery = initNewDelivery();
    const firstItemId = freshDelivery.items?.[0]?.itemId || Date.now().toString();
    
    setNewDelivery(freshDelivery);
    setQuantityInputs({ [firstItemId]: '1' });
    setUseCustomAmount(false);
    setCustomAmountInput('');
    setAmountError('');
  };

  const handlePickupLocationSelect = useCallback((location: any) => {
    const address = location?.address || '';
    const locationObject: Location | undefined = address ? {
      id: location?.id || `pickup_${Date.now()}`,
      name: location?.name || address.split(',')[0].trim() || 'Pickup Location',
      address: address,
      latitude: typeof location?.latitude === 'number' ? location.latitude : -33.8688,
      longitude: typeof location?.longitude === 'number' ? location.longitude : 151.2093,
    } : undefined;
    
    setNewDelivery(prev => ({
      ...prev,
      pickupAddress: address,
      pickupLocation: locationObject
    }));
  }, []);

  const handleDropoffLocationSelect = useCallback((location: any) => {
    const address = location?.address || '';
    const locationObject: Location | undefined = address ? {
      id: location?.id || `dropoff_${Date.now()}`,
      name: location?.name || address.split(',')[0].trim() || 'Delivery Location',
      address: address,
      latitude: typeof location?.latitude === 'number' ? location.latitude : -33.8688,
      longitude: typeof location?.longitude === 'number' ? location.longitude : 151.2093,
    } : undefined;
    
    setNewDelivery(prev => ({
      ...prev,
      dropoffAddress: address,
      dropoffLocation: locationObject
    }));
  }, []);

  const loadDeliveryData = useCallback(async () => {
    setIsLoading(true);
    try {
      // In a real app, these would be API calls
      await Promise.all([
        loadDeliveryRequests(),
        loadAvailableRides(),
      ]);
    } catch (error) {
      console.error('Failed to load delivery data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeliveryData();
  }, [loadDeliveryData]);

  useEffect(() => {
    if (autoOpenCreate) {
      setActiveTab('create');
      setShowCreateModal(true);
    }
  }, [autoOpenCreate]);

  useEffect(() => {
    if (showCreateModal) {
      resetForm();
    }
  }, [showCreateModal]);

  const loadDeliveryRequests = async () => {
    // Mock data for demo
    const mockRequests: DeliveryRequest[] = [
      {
        id: '1',
        businessId: 'business_1',
        items: [
          { itemId: '1', name: 'Office Supplies', quantity: 1 },
          { itemId: '2', name: 'Documents', quantity: 3 },
        ],
        pickupAddress: 'Sydney CBD, NSW',
        dropoffAddress: 'Parramatta, NSW',
        packageSize: 'medium',
        specialInstructions: 'Handle with care - fragile documents',
        priceCents: 800,
        preferredTimeWindow: {
          start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
          end: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours from now
        },
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        businessId: 'business_2',
        items: [
          { itemId: '3', name: 'Marketing Materials', quantity: 5 },
        ],
        pickupAddress: 'Melbourne CBD, VIC',
        dropoffAddress: 'Richmond, VIC',
        packageSize: 'large',
        specialInstructions: 'Urgent delivery needed',
        priceCents: 1200,
        preferredTimeWindow: {
          start: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
          end: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        },
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    ];
    
    setDeliveryRequests(mockRequests);
  };

  const loadAvailableRides = async () => {
    // Mock data for rides that accept deliveries
    const mockRides: Ride[] = [
      {
        id: 'ride_1',
        driverId: 'driver_1',
        origin: { name: 'Sydney CBD', address: 'Sydney CBD, NSW', lat: -33.8688, lng: 151.2093 },
        destination: { name: 'Parramatta', address: 'Parramatta, NSW', lat: -33.8150, lng: 150.9999 },
        departureAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        totalSeats: 4,
        seatsAvailable: 2,
        pricePerSeatCents: 1500,
        status: 'active',
        acceptDeliveries: true,
        cargoCapacity: 20,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    
    setAvailableRides(mockRides);
  };

  const addDeliveryItem = () => {
    const newItem: DeliveryItem = {
      itemId: Date.now().toString(),
      name: '',
      quantity: 1,
    };
    setNewDelivery(prev => ({
      ...prev,
      items: [...(prev.items || []), newItem],
    }));
    setQuantityInputs(prev => ({ ...prev, [newItem.itemId]: '1' }));
  };

  const updateDeliveryItem = (itemId: string, field: keyof DeliveryItem, value: any) => {
    if (field === 'quantity') {
      setQuantityInputs(prev => ({ ...prev, [itemId]: String(value) }));
      return;
    }
    setNewDelivery(prev => ({
      ...prev,
      items: (prev.items || []).map(item => (item.itemId === itemId ? { ...item, [field]: value } : item)),
    }));
  };

  const removeDeliveryItem = (itemId: string) => {
    setNewDelivery(prev => ({
      ...prev,
      items: (prev.items || []).filter(item => item.itemId !== itemId),
    }));
    setQuantityInputs(prev => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
  };

  const validateLocationData = (location: Location | undefined, address: string | undefined, fieldName: string): boolean => {
    const hasAddress = address && address.trim().length > 3;
    if (!hasAddress) {
      Alert.alert(`${fieldName} Required`, `Please enter and select a ${fieldName.toLowerCase()} from the suggestions.`);
      return false;
    }
    return true;
  };

  const validateAmount = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    if (cleaned === '') {
      setAmountError('');
      return { valid: false, cents: 0 };
    }
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      setAmountError('Invalid amount');
      return { valid: false, cents: 0 };
    }
    if (parts[1] && parts[1].length > 2) {
      setAmountError('Max two decimals');
      return { valid: false, cents: 0 };
    }
    const value = Number(cleaned);
    if (Number.isNaN(value)) {
      setAmountError('Invalid amount');
      return { valid: false, cents: 0 };
    }
    if (value < 1) {
      setAmountError('Minimum is $1.00');
      return { valid: false, cents: 0 };
    }
    const cents = Math.round(value * 100);
    if (cents > MAX_CUSTOM_AMOUNT_CENTS) {
      setAmountError(`Maximum is ${(MAX_CUSTOM_AMOUNT_CENTS / 100).toFixed(2)}`);
      return { valid: false, cents };
    }
    setAmountError('');
    return { valid: true, cents };
  }, []);

  const effectiveAmountCents = useMemo(() => {
    if (useCustomAmount) {
      const { valid, cents } = validateAmount(customAmountInput);
      return valid ? cents : 0;
    }
    return newDelivery.priceCents || 500;
  }, [useCustomAmount, customAmountInput, newDelivery.priceCents, validateAmount]);

  const createDeliveryRequest = async () => {
    console.log('Creating delivery request with data:', {
      user: !!user,
      items: newDelivery.items,
      pickupLocation: newDelivery.pickupLocation,
      dropoffLocation: newDelivery.dropoffLocation,
      pickupAddress: newDelivery.pickupAddress,
      dropoffAddress: newDelivery.dropoffAddress,
      useCustomAmount,
      customAmountInput,
      effectiveAmountCents
    });

    // Validate user
    if (!user) {
      Alert.alert('Authentication Required', 'Please log in to create a delivery request.');
      return;
    }

    // Validate items - check for valid items with names
    const validItems = (newDelivery.items || []).filter(item => 
      item.name && item.name.trim() !== '' && item.quantity && item.quantity > 0
    );
    
    if (validItems.length === 0) {
      Alert.alert('Items Required', 'Please add at least one item with a name and quantity.');
      return;
    }

    // Simplified location validation
    if (!validateLocationData(newDelivery.pickupLocation, newDelivery.pickupAddress, 'Pickup Address')) {
      return;
    }

    if (!validateLocationData(newDelivery.dropoffLocation, newDelivery.dropoffAddress, 'Delivery Address')) {
      return;
    }

    // Validate custom amount if used
    if (useCustomAmount) {
      const check = validateAmount(customAmountInput);
      if (!check.valid) {
        Alert.alert('Invalid Amount', amountError || 'Please enter a valid amount between $1.00 and $100.00');
        return;
      }
    }

    // Update the delivery with only valid items
    setNewDelivery(prev => ({ ...prev, items: validItems }));
    setShowConfirmModal(true);
  };

  const acceptDelivery = async (deliveryId: string, rideId: string) => {
    try {
      // In a real app, this would call the backend
      console.log('Accepting delivery:', deliveryId, 'for ride:', rideId);
      
      setDeliveryRequests(prev =>
        prev.map(delivery =>
          delivery.id === deliveryId
            ? { ...delivery, status: 'confirmed', matchedRideId: rideId }
            : delivery
        )
      );

      Alert.alert(
        'Delivery Accepted',
        'You have successfully accepted this delivery. The user will be notified and pickup details will be shared.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to accept delivery:', error);
      Alert.alert('Error', 'Failed to accept delivery. Please try again.');
    }
  };

  const renderDeliveryCard = ({ item: delivery }: { item: DeliveryRequest }) => {
    const packageSizeInfo = PACKAGE_SIZES.find(size => size.value === delivery.packageSize);
    const isDriver = user?.role === 'driver';
    const canAccept = isDriver && delivery.status === 'pending';
    
    return (
      <View style={styles.deliveryCard}>
        <View style={styles.deliveryHeader}>
          <View style={styles.deliveryTitleRow}>
            <Package size={20} color="#007bff" />
            <Text style={styles.deliveryTitle}>
              {delivery.items.length} item{delivery.items.length !== 1 ? 's' : ''} • {packageSizeInfo?.label}
            </Text>
          </View>
          
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(delivery.status) }]}>
            <Text style={styles.statusText}>{delivery.status.toUpperCase()}</Text>
          </View>
        </View>
        
        <View style={styles.deliveryRoute}>
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, styles.pickupDot]} />
            <Text style={styles.routeText} numberOfLines={2}>
              Pickup: {delivery.pickupAddress}
            </Text>
          </View>
          
          <View style={styles.routeLine} />
          
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, styles.dropoffDot]} />
            <Text style={styles.routeText} numberOfLines={2}>
              Dropoff: {delivery.dropoffAddress}
            </Text>
          </View>
        </View>
        
        <View style={styles.deliveryDetails}>
          <View style={styles.detailRow}>
            <Clock size={16} color="#6c757d" />
            <Text style={styles.detailText}>
              {formatDate(delivery.preferredTimeWindow.start)} - {formatTime(delivery.preferredTimeWindow.end)}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <DollarSign size={16} color="#28a745" />
            <Text style={styles.priceText}>
              {formatCurrency(delivery.priceCents / 100)} delivery fee
            </Text>
          </View>
        </View>
        
        {delivery.specialInstructions && (
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsLabel}>Special Instructions:</Text>
            <Text style={styles.instructionsText}>{delivery.specialInstructions}</Text>
          </View>
        )}
        
        <View style={styles.itemsList}>
          <Text style={styles.itemsLabel}>Items:</Text>
          {delivery.items.map((item, index) => (
            <Text key={item.itemId} style={styles.itemText}>
              • {item.name} (x{item.quantity})
            </Text>
          ))}
        </View>
        
        {canAccept && (
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => showRideMatchingModal(delivery)}
          >
            <Truck size={20} color="#ffffff" />
            <Text style={styles.acceptButtonText}>Accept Delivery</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const showRideMatchingModal = (delivery: DeliveryRequest) => {
    // Find matching rides based on route
    const matchingRides = availableRides.filter(ride => {
      // Simple matching logic - in a real app, this would use proper route matching
      const rideOrigin = ride.origin?.name || '';
      const rideDestination = ride.destination?.name || '';
      
      return (
        rideOrigin.toLowerCase().includes(delivery.pickupAddress.toLowerCase().split(',')[0]) ||
        rideDestination.toLowerCase().includes(delivery.dropoffAddress.toLowerCase().split(',')[0])
      );
    });

    if (matchingRides.length === 0) {
      Alert.alert(
        'No Matching Rides',
        'No rides found that match this delivery route. Create a ride first or check back later.',
        [{ text: 'OK' }]
      );
      return;
    }

    const rideOptions = matchingRides.map(ride => ({
      text: `${ride.origin?.name} → ${ride.destination?.name} (${formatDate(ride.departureAt)})`,
      onPress: () => acceptDelivery(delivery.id!, ride.id),
    }));

    rideOptions.push({ text: 'Cancel', style: 'cancel' as const });

    Alert.alert(
      'Select Matching Ride',
      'Choose which of your rides will handle this delivery:',
      rideOptions
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#ffc107';
      case 'confirmed': return '#007bff';
      case 'in_transit': return '#fd7e14';
      case 'delivered': return '#28a745';
      case 'cancelled': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const commitQuantityInputs = () => {
    setNewDelivery(prev => ({
      ...prev,
      items: (prev.items || []).map(item => {
        const raw = quantityInputs[item.itemId];
        if (raw === undefined) return item;
        const clean = (raw || '').replace(/[^0-9]/g, '');
        const num = clean === '' ? 1 : Math.max(1, Math.min(parseInt(clean, 10), 999));
        return { ...item, quantity: num };
      }),
    }));
  };

  const handleSubmitConfirmed = async () => {
    // Comprehensive validation
    if (!user) {
      Alert.alert('Error', 'Please log in to create a delivery.');
      return;
    }
    
    // Simplified location validation
    if (!validateLocationData(newDelivery.pickupLocation, newDelivery.pickupAddress, 'Pickup Address')) {
      return;
    }

    if (!validateLocationData(newDelivery.dropoffLocation, newDelivery.dropoffAddress, 'Delivery Address')) {
      return;
    }
    
    const validItems = (newDelivery.items || []).filter(item => 
      item.name && item.name.trim() !== '' && item.quantity && item.quantity > 0
    );
    
    if (validItems.length === 0) {
      Alert.alert('Error', 'Please add at least one item with a name and quantity.');
      return;
    }
    
    try {
      commitQuantityInputs();
      console.log('Creating delivery with data:', {
        pickup: newDelivery.pickupLocation,
        dropoff: newDelivery.dropoffLocation,
        items: newDelivery.items,
        packageSize: newDelivery.packageSize,
        effectiveAmount: effectiveAmountCents
      });
      
      // Filter to only valid items before creating payload
      const validItems = (newDelivery.items || []).filter(item => 
        item.name && item.name.trim() !== '' && item.quantity && item.quantity > 0
      );
      
      if (validItems.length === 0) {
        Alert.alert('Error', 'Please add at least one valid item with a name and quantity.');
        return;
      }
      
      // Use the best available address and location data
      const pickupAddress = newDelivery.pickupLocation?.address || newDelivery.pickupAddress || '';
      const dropoffAddress = newDelivery.dropoffLocation?.address || newDelivery.dropoffAddress || '';
      const pickupLat = newDelivery.pickupLocation?.latitude || -33.8688;
      const pickupLng = newDelivery.pickupLocation?.longitude || 151.2093;
      const dropoffLat = newDelivery.dropoffLocation?.latitude || -33.8688;
      const dropoffLng = newDelivery.dropoffLocation?.longitude || 151.2093;
      
      const payload: CreateDeliveryV2Request = {
        pickup: {
          address: pickupAddress,
          lat: pickupLat,
          lng: pickupLng,
          time: newDelivery.preferredTimeWindow?.start || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
        },
        dropoff: {
          address: dropoffAddress,
          lat: dropoffLat,
          lng: dropoffLng,
        },
        items: validItems.map(i => ({ 
          type: i.name.trim(), 
          qty: i.quantity,
          fragile: false 
        })),
        size: (newDelivery.packageSize || 'small').toString(),
        vehicleRequirement: 'Car',
        fee: useCustomAmount
          ? { presetOption: null, customAmount: Number((customAmountInput || '5')) }
          : { presetOption: (newDelivery.priceCents || 500) / 100, customAmount: null },
        specialInstructions: newDelivery.specialInstructions || '',
        requesterId: user.id,
        paymentRequired: true,
      };

      const result = await DeliveryService.createDeliveryV2(payload);
      console.log('Delivery created successfully:', result);
      
      setShowConfirmModal(false);
      setShowCreateModal(false);

      // Update local state for immediate feedback
      setDeliveryRequests(prev => [
        {
          id: result.id,
          businessId: user.id,
          items: newDelivery.items || [],
          pickupAddress: pickupAddress,
          dropoffAddress: dropoffAddress,
          pickupLocation: newDelivery.pickupLocation,
          dropoffLocation: newDelivery.dropoffLocation,
          packageSize: newDelivery.packageSize as any,
          specialInstructions: newDelivery.specialInstructions || '',
          priceCents: effectiveAmountCents,
          preferredTimeWindow: {
            start: payload.pickup.time,
            end: new Date(new Date(payload.pickup.time).getTime() + 4 * 60 * 60 * 1000).toISOString()
          },
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);

      Alert.alert(
        'Delivery Created', 
        'Your delivery request has been posted successfully! Drivers in your area will be notified.',
        [{ text: 'OK' }]
      );
      
      // Reset form with initial item
      const resetItem: DeliveryItem = {
        itemId: Date.now().toString(),
        name: '',
        quantity: 1,
      };
      
      setNewDelivery(initNewDelivery());
      setQuantityInputs({ [resetItem.itemId]: '1' });
      setUseCustomAmount(false);
      setCustomAmountInput('');
      
      // Call onClose to refresh parent component
      if (onClose) {
        onClose();
      }
    } catch (e: any) {
      console.error('Create delivery failed:', e);
      const errorMessage = e?.message || 'Failed to create delivery. Please try again.';
      Alert.alert('Error', errorMessage);
    }
  };

  const renderCreateDeliveryModal = () => (
    <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Create Delivery Request</Text>
          <TouchableOpacity onPress={() => { 
            setShowCreateModal(false); 
            resetForm();
          }}>
            <X size={24} color="#495057" />
          </TouchableOpacity>
        </View>
        
        <ScrollView 
          style={styles.modalContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Pickup & Delivery</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Pickup Address *</Text>
              <PlacesAutocomplete
                key="pickup-autocomplete"
                placeholder="Enter pickup address"
                onLocationSelect={handlePickupLocationSelect}
                value={newDelivery.pickupLocation}
                style={styles.autocompleteContainer}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Delivery Address *</Text>
              <PlacesAutocomplete
                key="dropoff-autocomplete"
                placeholder="Enter delivery address"
                onLocationSelect={handleDropoffLocationSelect}
                value={newDelivery.dropoffLocation}
                style={styles.autocompleteContainer}
              />
            </View>
          </View>
          
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Package Details</Text>
            
            <View style={styles.packageSizeSelector}>
              {PACKAGE_SIZES.map((size) => (
                <TouchableOpacity
                  key={size.value}
                  testID={`size-${size.value}`}
                  style={[
                    styles.packageSizeOption,
                    newDelivery.packageSize === size.value && styles.packageSizeOptionSelected,
                  ]}
                  onPress={() => {
                    setUseCustomAmount(false);
                    setNewDelivery(prev => ({ 
                      ...prev, 
                      packageSize: size.value as any,
                      priceCents: size.price,
                    }));
                  }}
                >
                  <Text style={[
                    styles.packageSizeLabel,
                    newDelivery.packageSize === size.value && styles.packageSizeLabelSelected,
                  ]}>
                    {size.label}
                  </Text>
                  <Text style={styles.packageSizeDescription}>{size.description}</Text>
                  <Text style={styles.packageSizePrice}>{formatCurrency(size.price / 100)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Delivery Fee</Text>
            <View style={styles.amountRow}>
              {PRESET_AMOUNTS.map((amt) => (
                <TouchableOpacity
                  key={amt}
                  testID={`preset-${amt}`}
                  style={[styles.amountChip, !useCustomAmount && newDelivery.priceCents === amt && styles.amountChipSelected]}
                  onPress={() => { setUseCustomAmount(false); setNewDelivery(prev => ({ ...prev, priceCents: amt })); }}
                >
                  <DollarSign size={14} color={!useCustomAmount && newDelivery.priceCents === amt ? '#fff' : '#007bff'} />
                  <Text style={[styles.amountChipText, !useCustomAmount && newDelivery.priceCents === amt && styles.amountChipTextSelected]}>${(amt/100).toFixed(0)}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                testID="preset-custom"
                style={[styles.amountChip, useCustomAmount && styles.amountChipSelected]}
                onPress={() => setUseCustomAmount(true)}
              >
                <DollarSign size={14} color={useCustomAmount ? '#fff' : '#007bff'} />
                <Text style={[styles.amountChipText, useCustomAmount && styles.amountChipTextSelected]}>Custom</Text>
              </TouchableOpacity>
            </View>
            {useCustomAmount && (
              <View style={styles.customAmountRow}>
                <TextInput
                  testID="custom-amount-input"
                  style={[styles.textInput, styles.customAmountInput]}
                  placeholder="Enter amount (AUD)"
                  keyboardType="decimal-pad"
                  value={customAmountInput}
                  onChangeText={(t) => setCustomAmountInput(t)}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
                {amountError !== '' && (
                  <View style={styles.inlineError}>
                    <Info size={14} color="#dc3545" />
                    <Text style={styles.inlineErrorText}>{amountError}</Text>
                  </View>
                )}
              </View>
            )}
            {useCustomAmount && effectiveAmountCents > Math.max(...PRESET_AMOUNTS) && (
              <View style={styles.tipRow}>
                <Info size={14} color="#856404" />
                <Text style={styles.tipText}>You entered more than presets. Confirm on next step.</Text>
              </View>
            )}
          </View>
          
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Items to Deliver</Text>
            
            {(newDelivery.items || []).map((item) => (
              <View key={item.itemId} style={styles.itemRow}>
                <TextInput
                  style={[styles.textInput, styles.itemNameInput]}
                  value={item.name}
                  onChangeText={(text) => updateDeliveryItem(item.itemId, 'name', text)}
                  placeholder="Item name"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                />
                <TextInput
                  style={[styles.textInput, styles.itemQuantityInput]}
                  value={quantityInputs[item.itemId] ?? String(item.quantity)}
                  onChangeText={(text) => {
                    // Allow only numbers and limit to 3 digits
                    const clean = text.replace(/[^0-9]/g, '').slice(0, 3);
                    setQuantityInputs(prev => ({ ...prev, [item.itemId]: clean }));
                    
                    // Update the actual quantity immediately for better UX
                    if (clean !== '') {
                      const num = Math.max(1, Math.min(parseInt(clean, 10), 999));
                      setNewDelivery(prev => ({
                        ...prev,
                        items: (prev.items || []).map(it => it.itemId === item.itemId ? { ...it, quantity: num } : it),
                      }));
                    } else {
                      // If empty, set to 1 as minimum
                      setNewDelivery(prev => ({
                        ...prev,
                        items: (prev.items || []).map(it => it.itemId === item.itemId ? { ...it, quantity: 1 } : it),
                      }));
                    }
                  }}
                  onBlur={() => {
                    const raw = quantityInputs[item.itemId] ?? String(item.quantity);
                    const clean = raw.replace(/[^0-9]/g, '');
                    const num = clean === '' ? 1 : Math.max(1, Math.min(parseInt(clean, 10), 999));
                    
                    // Ensure the input shows the corrected value
                    setQuantityInputs(prev => ({ ...prev, [item.itemId]: String(num) }));
                    
                    // Update the delivery state
                    setNewDelivery(prev => ({
                      ...prev,
                      items: (prev.items || []).map(it => it.itemId === item.itemId ? { ...it, quantity: num } : it),
                    }));
                  }}
                  onFocus={() => {
                    // Select all text when focused for easier editing
                    const currentValue = quantityInputs[item.itemId] ?? String(item.quantity);
                    setQuantityInputs(prev => ({ ...prev, [item.itemId]: currentValue }));
                  }}
                  placeholder="Qty"
                  keyboardType="number-pad"
                  maxLength={3}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                  selectTextOnFocus={true}
                />
                <TouchableOpacity
                  style={styles.removeItemButton}
                  onPress={() => removeDeliveryItem(item.itemId)}
                >
                  <Trash2 size={16} color="#dc3545" />
                </TouchableOpacity>
              </View>
            ))}
            
            <TouchableOpacity style={styles.addItemButton} onPress={addDeliveryItem} testID="add-item">
              <Plus size={16} color="#007bff" />
              <Text style={styles.addItemText}>Add Item</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Additional Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Special Instructions</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={newDelivery.specialInstructions}
                onChangeText={(text) => setNewDelivery(prev => ({ ...prev, specialInstructions: text }))}
                placeholder="Any special handling instructions..."
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
                blurOnSubmit={true}
              />
            </View>
          </View>
        </ScrollView>
        
        <View style={styles.modalFooter}>
          <TouchableOpacity
            testID="create-delivery"
            accessibilityLabel="Create Delivery"
            style={styles.createButton}
            onPress={createDeliveryRequest}
          >
            <Text style={styles.createButtonText}>
              Continue - ${formatCurrency(effectiveAmountCents / 100)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showConfirmModal} transparent animationType="fade" onRequestClose={() => setShowConfirmModal(false)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Confirm Delivery</Text>
            <Text style={styles.confirmLine}>From: {newDelivery.pickupLocation?.address || newDelivery.pickupAddress}</Text>
            <Text style={styles.confirmLine}>To: {newDelivery.dropoffLocation?.address || newDelivery.dropoffAddress}</Text>
            <Text style={styles.confirmLine}>Items: {(newDelivery.items||[]).length}</Text>
            <Text style={styles.confirmLine}>Fee: ${formatCurrency(effectiveAmountCents/100)}</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.confirmBtn, styles.cancelBtn]} onPress={() => setShowConfirmModal(false)}>
                <Text style={styles.cancelText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="confirm-submit" style={[styles.confirmBtn, styles.submitBtn]} onPress={handleSubmitConfirmed}>
                <Text style={styles.submitText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );

  const renderBrowseTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>Available Deliveries</Text>
        <Text style={styles.tabSubtitle}>
          {user?.role === 'driver' 
            ? 'Accept deliveries that match your route'
            : 'Browse delivery requests from local users'
          }
        </Text>
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading deliveries...</Text>
        </View>
      ) : (
        <FlatList
          data={deliveryRequests}
          renderItem={renderDeliveryCard}
          keyExtractor={(item) => item.id || ''}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.deliveryList}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Package size={48} color="#6c757d" />
              <Text style={styles.emptyTitle}>No Deliveries Available</Text>
              <Text style={styles.emptyText}>
                {user?.role === 'driver' 
                  ? 'No delivery requests match your current routes'
                  : 'No users have posted delivery requests yet'
                }
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );

  const renderCreateTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>Post Delivery Request</Text>
        <Text style={styles.tabSubtitle}>
          Connect with drivers heading in your direction
        </Text>
      </View>
      
      <TouchableOpacity
        style={styles.createDeliveryButton}
        onPress={() => setShowCreateModal(true)}
      >
        <Plus size={24} color="#ffffff" />
        <Text style={styles.createDeliveryButtonText}>Create New Delivery Request</Text>
      </TouchableOpacity>
      
      <View style={styles.benefitsContainer}>
        <Text style={styles.benefitsTitle}>Why use CarpoolConnect for deliveries?</Text>
        
        <View style={styles.benefitItem}>
          <CheckCircle size={20} color="#28a745" />
          <Text style={styles.benefitText}>Cost-effective alternative to courier services</Text>
        </View>
        
        <View style={styles.benefitItem}>
          <CheckCircle size={20} color="#28a745" />
          <Text style={styles.benefitText}>Real-time tracking and communication</Text>
        </View>
        
        <View style={styles.benefitItem}>
          <CheckCircle size={20} color="#28a745" />
          <Text style={styles.benefitText}>Verified drivers with ratings</Text>
        </View>
        
        <View style={styles.benefitItem}>
          <CheckCircle size={20} color="#28a745" />
          <Text style={styles.benefitText}>Flexible pickup and delivery times</Text>
        </View>
      </View>
    </View>
  );

  const renderManageTab = () => {
    const userDeliveries = deliveryRequests.filter(d => d.businessId === user?.id);
    
    return (
      <View style={styles.tabContent}>
        <View style={styles.tabHeader}>
          <Text style={styles.tabTitle}>My Delivery Requests</Text>
          <Text style={styles.tabSubtitle}>
            Track and manage your delivery requests
          </Text>
        </View>
        
        <FlatList
          data={userDeliveries}
          renderItem={renderDeliveryCard}
          keyExtractor={(item) => item.id || ''}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.deliveryList}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Package size={48} color="#6c757d" />
              <Text style={styles.emptyTitle}>No Delivery Requests</Text>
              <Text style={styles.emptyText}>
                You have not created any delivery requests yet
              </Text>
              <TouchableOpacity
                style={styles.createFirstButton}
                onPress={() => setShowCreateModal(true)}
              >
                <Text style={styles.createFirstButtonText}>Create Your First Request</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Delivery Marketplace</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} testID="delivery-marketplace-close">
            <X size={24} color="#495057" />
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.tabBar}>
        <TouchableOpacity
          testID="tab-browse"
          style={[styles.tab, activeTab === 'browse' && styles.activeTab]}
          onPress={() => setActiveTab('browse')}
        >
          <Search size={20} color={activeTab === 'browse' ? '#007bff' : '#6c757d'} />
          <Text style={[styles.tabText, activeTab === 'browse' && styles.activeTabText]}>
            Browse
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          testID="tab-create"
          style={[styles.tab, activeTab === 'create' && styles.activeTab]}
          onPress={() => setActiveTab('create')}
        >
          <Plus size={20} color={activeTab === 'create' ? '#007bff' : '#6c757d'} />
          <Text style={[styles.tabText, activeTab === 'create' && styles.activeTabText]}>
            {user?.role === 'driver' ? 'Accept Delivery' : 'Create'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          testID="tab-manage"
          style={[styles.tab, activeTab === 'manage' && styles.activeTab]}
          onPress={() => setActiveTab('manage')}
        >
          <Package size={20} color={activeTab === 'manage' ? '#007bff' : '#6c757d'} />
          <Text style={[styles.tabText, activeTab === 'manage' && styles.activeTabText]}>
            My Requests
          </Text>
        </TouchableOpacity>
      </View>
      
      {activeTab === 'browse' && renderBrowseTab()}
      {activeTab === 'create' && renderCreateTab()}
      {activeTab === 'manage' && renderManageTab()}
      
      {renderCreateDeliveryModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212529',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007bff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
  },
  activeTabText: {
    color: '#007bff',
  },
  tabContent: {
    flex: 1,
  },
  tabHeader: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tabTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  tabSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
  },
  deliveryList: {
    padding: 16,
  },
  deliveryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  deliveryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  deliveryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  deliveryRoute: {
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  pickupDot: {
    backgroundColor: '#28a745',
  },
  dropoffDot: {
    backgroundColor: '#dc3545',
  },
  routeLine: {
    width: 2,
    height: 12,
    backgroundColor: '#dee2e6',
    marginLeft: 4,
    marginVertical: 2,
  },
  routeText: {
    fontSize: 14,
    color: '#495057',
    flex: 1,
  },
  deliveryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#6c757d',
  },
  priceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#28a745',
  },
  instructionsContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  instructionsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 4,
  },
  instructionsText: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 18,
  },
  itemsList: {
    marginBottom: 12,
  },
  itemsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 6,
  },
  itemText: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 2,
  },
  acceptButton: {
    backgroundColor: '#007bff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  acceptButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  createDeliveryButton: {
    backgroundColor: '#007bff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    gap: 8,
  },
  createDeliveryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  benefitsContainer: {
    padding: 20,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  benefitText: {
    fontSize: 16,
    color: '#495057',
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#495057',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 20,
  },
  createFirstButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  createFirstButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6c757d',
    marginTop: 12,
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
  formSection: {
    marginBottom: 24,
  },
  amountRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  amountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#007bff',
    backgroundColor: '#ffffff',
  },
  amountChipSelected: {
    backgroundColor: '#007bff',
  },
  amountChipText: {
    color: '#007bff',
    fontSize: 14,
    fontWeight: '600',
  },
  amountChipTextSelected: {
    color: '#ffffff',
  },
  customAmountRow: {
    marginTop: 8,
  },
  customAmountInput: {
    fontSize: 16,
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  inlineErrorText: {
    color: '#dc3545',
    fontSize: 12,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff3cd',
    padding: 8,
    borderRadius: 8,
  },
  tipText: {
    color: '#856404',
    fontSize: 12,
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxWidth: 420,
    gap: 8,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    color: '#212529',
  },
  confirmLine: {
    fontSize: 14,
    color: '#495057',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  cancelBtn: {
    backgroundColor: '#f1f3f5',
  },
  submitBtn: {
    backgroundColor: '#007bff',
  },
  cancelText: { color: '#212529', fontSize: 16, fontWeight: '600' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 12,
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  autocompleteContainer: {
    marginBottom: 0,
  },
  packageSizeSelector: {
    gap: 8,
  },
  packageSizeOption: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#ffffff',
  },
  packageSizeOptionSelected: {
    borderColor: '#007bff',
    backgroundColor: '#f8f9ff',
  },
  packageSizeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 2,
  },
  packageSizeLabelSelected: {
    color: '#007bff',
  },
  packageSizeDescription: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  packageSizePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#28a745',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  itemNameInput: {
    flex: 2,
  },
  itemQuantityInput: {
    flex: 1,
    textAlign: 'center',
  },
  removeItemButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fee',
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#007bff',
    borderRadius: 8,
    borderStyle: 'dashed',
    gap: 6,
  },
  addItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007bff',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  createButton: {
    backgroundColor: '#007bff',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});