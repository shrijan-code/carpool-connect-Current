import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Alert } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/colors';
// import { StripePaymentService } from '@/services/stripe'; // Commented out to avoid web bundling issues

interface StripePaymentProps {
  amount: number; // Amount in dollars
  rideId: string;
  bookingId: string;
  driverStripeAccountId: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
}

// Web-only component
const StripePaymentWeb: React.FC<StripePaymentProps> = ({
  amount,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const platformFee = 5.00; // Fixed $5 fee
  const totalAmount = amount + platformFee;

  const handlePayment = async () => {
    setIsLoading(true);
    Alert.alert(
      'Payment Demo',
      `This is a demo. In production, web payments would be handled via Stripe Elements or redirect to a payment page.\n\nAmount: $${totalAmount.toFixed(2)}`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setIsLoading(false) },
        {
          text: 'Simulate Success',
          onPress: () => {
            console.log('Simulated payment success on web');
            onSuccess('demo_payment_intent_web');
            setIsLoading(false);
          },
        },
      ]
    );
  };

  return (
    <Card style={styles.container}>
      <Text style={styles.title}>Payment Details</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Ride Cost:</Text>
        <Text style={styles.value}>${amount.toFixed(2)}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Platform Fee:</Text>
        <Text style={styles.value}>${platformFee.toFixed(2)}</Text>
      </View>

      <View style={[styles.row, styles.totalRow]}>
        <Text style={styles.totalLabel}>Total:</Text>
        <Text style={styles.totalValue}>${totalAmount.toFixed(2)}</Text>
      </View>

      <Button
        title={isLoading ? 'Processing...' : `Demo Pay $${totalAmount.toFixed(2)}`}
        onPress={handlePayment}
        disabled={isLoading}
        style={styles.payButton}
      />

      <Text style={styles.disclaimer}>
        Demo mode on web. In production, use Stripe Elements for web payments.
      </Text>
    </Card>
  );
};

// Native-only component
const StripePaymentNative: React.FC<StripePaymentProps> = ({
  amount,
  rideId,
  bookingId,
  driverStripeAccountId,
  onSuccess,
  onError,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handlePayment = async () => {
    try {
      setIsLoading(true);

      // Simulate payment for now since Stripe native doesn't work on web
      console.log('Simulating native payment...');

      // In a real app, you would:
      // 1. Create payment intent on backend
      // 2. Use Stripe's payment sheet
      // 3. Handle the result

      setTimeout(() => {
        console.log('Payment successful (simulated)');
        onSuccess('simulated_payment_intent_native');
        setIsLoading(false);
      }, 2000);

      return;

      // This code would work on real native devices:
      /*
      const { clientSecret, paymentIntentId } = await StripePaymentService.createPaymentIntent({
        amount: Math.round(amount * 100),
        driverStripeAccountId,
        rideId,
        bookingId,
        platformFeeAmount: Math.round(amount * 10),
      });

      const { useStripe } = require('@stripe/stripe-react-native');
      const { initPaymentSheet, presentPaymentSheet } = useStripe();

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'RideShare App',
        paymentIntentClientSecret: clientSecret,
        defaultBillingDetails: {
          name: 'Rider Name',
        },
        allowsDelayedPaymentMethods: false,
        returnURL: 'rideshare://payment-return',
      });

      if (initError) {
        console.error('Payment sheet initialization error:', initError);
        onError(initError.message);
        return;
      }

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') {
          console.log('Payment canceled by user');
          return;
        }
        console.error('Payment sheet presentation error:', presentError);
        onError(presentError.message);
        return;
      }

      console.log('Payment successful:', paymentIntentId);
      onSuccess(paymentIntentId);
      */

    } catch (error) {
      console.error('Payment processing error:', error);
      onError(error instanceof Error ? error.message : 'Payment failed');
    } finally {
      setIsLoading(false);
    }
  };

  const platformFee = 5.00; // Fixed $5 fee
  const totalAmount = amount + platformFee;

  return (
    <Card style={styles.container}>
      <Text style={styles.title}>Payment Details</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Ride Cost:</Text>
        <Text style={styles.value}>${amount.toFixed(2)}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Platform Fee:</Text>
        <Text style={styles.value}>${platformFee.toFixed(2)}</Text>
      </View>

      <View style={[styles.row, styles.totalRow]}>
        <Text style={styles.totalLabel}>Total:</Text>
        <Text style={styles.totalValue}>${totalAmount.toFixed(2)}</Text>
      </View>

      <Button
        title={isLoading ? 'Processing...' : `Pay $${totalAmount.toFixed(2)}`}
        onPress={handlePayment}
        disabled={isLoading}
        style={styles.payButton}
      />

      <Text style={styles.disclaimer}>
        Secure payment powered by Stripe. Your payment information is encrypted and secure.
      </Text>
    </Card>
  );
};

// Main component that chooses between web and native
export const StripePayment: React.FC<StripePaymentProps> = (props) => {
  if (Platform.OS === 'web') {
    return <StripePaymentWeb {...props} />;
  }
  return <StripePaymentNative {...props} />;
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    margin: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  value: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  payButton: {
    marginBottom: 12,
  },
  disclaimer: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 16,
  },
});