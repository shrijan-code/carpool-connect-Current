import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Car, Users, Bell } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth-store';
import { BookingModal } from '@/components/BookingModal';
import { DriverBookingRequests } from '@/components/DriverBookingRequests';
import { RideControls } from '@/components/RideControls';
import { CarpoolBookingService } from '@/services/carpool-booking';

// Mock ride data for demonstration
type MockRideStatus = 'upcoming' | 'active' | 'completed';

type MockRide = {
  id: string;
  pricePerSeat: number;
  seatsAvailable: number;
  seatsTotal: number;
  status: MockRideStatus;
  origin: { name: string };
  destination: { name: string };
  departureTime: string;
  driver: { name: string };
  passengers: Array<{
    id: string;
    seats: number;
    user: { name: string };
  }>;
};

const mockRide: MockRide = {
  id: 'ride_123',
  pricePerSeat: 1500,
  seatsAvailable: 3,
  seatsTotal: 4,
  status: 'upcoming',
  origin: { name: 'Sydney CBD' },
  destination: { name: 'Bondi Beach' },
  departureTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  driver: { name: 'John Smith' },
  passengers: [
    {
      id: 'passenger_1',
      seats: 1,
      user: { name: 'Alice Johnson' }
    }
  ]
};

export default function CarpoolBookingDemo() {
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState(1);
  const [activeTab, setActiveTab] = useState<'rider' | 'driver'>('rider');
  const [ride, setRide] = useState<MockRide>(mockRide);
  const { user } = useAuthStore();

  const handleBookingSuccess = (bookingId: string) => {
    console.log('Booking created:', bookingId);
    // In a real app, you would refresh the ride data or navigate to bookings screen
    Alert.alert(
      'Success!',
      'Your booking request has been sent to the driver. You will be notified when they respond.'
    );
  };

  const handleRideUpdated = () => {
    // In a real app, you would fetch updated ride data from your backend
    console.log('Ride updated, refreshing data...');
    
    // Mock updating ride status
    if (ride.status === 'upcoming') {
      setRide(prev => ({ ...prev, status: 'active' as MockRideStatus }));
    } else if (ride.status === 'active') {
      setRide(prev => ({ ...prev, status: 'completed' as MockRideStatus }));
    }
  };

  const renderRiderView = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🚗 Book a Ride</Text>
      
      {/* Mock Ride Card */}
      <View style={styles.rideCard}>
        <View style={styles.rideHeader}>
          <Text style={styles.routeText}>
            {ride.origin.name} → {ride.destination.name}
          </Text>
          <Text style={styles.priceText}>
            {CarpoolBookingService.formatCurrency(ride.pricePerSeat)}/seat
          </Text>
        </View>
        
        <Text style={styles.timeText}>
          {new Date(ride.departureTime).toLocaleString()}
        </Text>
        
        <Text style={styles.driverText}>Driver: {ride.driver.name}</Text>
        
        <View style={styles.seatsContainer}>
          <Users size={16} color="#666" />
          <Text style={styles.seatsText}>
            {ride.seatsAvailable} of {ride.seatsTotal} seats available
          </Text>
        </View>
        
        {/* Seat Selection */}
        <View style={styles.seatSelection}>
          <Text style={styles.seatLabel}>Select seats:</Text>
          <View style={styles.seatButtons}>
            {[1, 2, 3, 4].map(num => (
              <TouchableOpacity
                key={num}
                style={[
                  styles.seatButton,
                  selectedSeats === num && styles.seatButtonActive,
                  num > ride.seatsAvailable && styles.seatButtonDisabled
                ]}
                onPress={() => setSelectedSeats(num)}
                disabled={num > ride.seatsAvailable}
              >
                <Text style={[
                  styles.seatButtonText,
                  selectedSeats === num && styles.seatButtonTextActive,
                  num > ride.seatsAvailable && styles.seatButtonTextDisabled
                ]}>
                  {num}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.bookButton}
          onPress={() => setShowBookingModal(true)}
          disabled={ride.seatsAvailable === 0}
        >
          <Text style={styles.bookButtonText}>
            Book {selectedSeats} Seat{selectedSeats > 1 ? 's' : ''} - {CarpoolBookingService.formatCurrency(ride.pricePerSeat * selectedSeats)}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Booking Modal */}
      <BookingModal
        visible={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        ride={ride}
        seats={selectedSeats}
        onBookingSuccess={handleBookingSuccess}
      />
    </View>
  );

  const renderDriverView = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🚙 Driver Dashboard</Text>
      
      {/* Ride Controls */}
      <RideControls
        ride={ride}
        onRideUpdated={handleRideUpdated}
      />
      
      {/* Booking Requests */}
      <View style={styles.bookingRequestsContainer}>
        <Text style={styles.subsectionTitle}>📱 Booking Requests</Text>
        <DriverBookingRequests />
      </View>
    </View>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loginPrompt}>
          <Text style={styles.loginText}>Please log in to use the carpool booking system</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Carpool Booking Demo</Text>
          <Text style={styles.headerSubtitle}>
            Complete booking flow with mock payments
          </Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'rider' && styles.activeTab]}
            onPress={() => setActiveTab('rider')}
          >
            <Users size={20} color={activeTab === 'rider' ? '#007AFF' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'rider' && styles.activeTabText]}>
              Rider View
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'driver' && styles.activeTab]}
            onPress={() => setActiveTab('driver')}
          >
            <Car size={20} color={activeTab === 'driver' ? '#007AFF' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'driver' && styles.activeTabText]}>
              Driver View
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {activeTab === 'rider' ? renderRiderView() : renderDriverView()}

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>🔄 Booking Flow</Text>
          <View style={styles.flowStep}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepText}>
              <Text style={styles.stepBold}>Rider books ride:</Text> Creates pending booking with mock payment authorization
            </Text>
          </View>
          <View style={styles.flowStep}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepText}>
              <Text style={styles.stepBold}>Driver responds:</Text> Accepts or declines the booking request
            </Text>
          </View>
          <View style={styles.flowStep}>
            <Text style={styles.stepNumber}>3</Text>
            <Text style={styles.stepText}>
              <Text style={styles.stepBold}>Driver starts ride:</Text> Updates ride status to active
            </Text>
          </View>
          <View style={styles.flowStep}>
            <Text style={styles.stepNumber}>4</Text>
            <Text style={styles.stepText}>
              <Text style={styles.stepBold}>Driver completes ride:</Text> Charges payments and processes driver payout
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollView: {
    flex: 1,
  },
  loginPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loginText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
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
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#007AFF',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  rideCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  timeText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  driverText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  seatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  seatsText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  seatSelection: {
    marginBottom: 16,
  },
  seatLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  seatButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  seatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  seatButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  seatButtonDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E5E5E5',
  },
  seatButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  seatButtonTextActive: {
    color: '#FFF',
  },
  seatButtonTextDisabled: {
    color: '#CCC',
  },
  bookButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  bookButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  bookingRequestsContainer: {
    marginTop: 24,
  },
  infoSection: {
    padding: 20,
    backgroundColor: '#FFF',
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  flowStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: 12,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  stepBold: {
    fontWeight: '600',
    color: '#1A1A1A',
  },
});