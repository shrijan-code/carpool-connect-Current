import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/hooks/useTheme';
import { DollarSign, Users, TrendingDown, X, Info } from 'lucide-react-native';

interface RideCostCalculatorProps {
  visible: boolean;
  onClose: () => void;
  basePrice: number; // in cents
  distance?: string;
  duration?: string;
}

export function RideCostCalculator({
  visible,
  onClose,
  basePrice,
  distance,
  duration
}: RideCostCalculatorProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [selectedSeats, setSelectedSeats] = useState<number>(1);

  const calculations = useMemo(() => {
    const platformFee = 5.00; // $5 flat platform fee
    const basePriceInDollars = basePrice / 100;
    const subtotal = basePriceInDollars * selectedSeats;
    const total = subtotal + platformFee;
    const costPerPerson = selectedSeats > 1 ? total / selectedSeats : total;
    const savings = selectedSeats > 1 ? (total * selectedSeats) - total : 0;
    const savingsPercent = selectedSeats > 1 ? ((savings / (total * selectedSeats)) * 100) : 0;

    return {
      subtotal,
      platformFee,
      total,
      costPerPerson,
      savings,
      savingsPercent
    };
  }, [basePrice, selectedSeats]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <LinearGradient
            colors={colors.gradient.cyberpunk}
            style={styles.modalHeader}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.headerTop}>
              <Text style={styles.modalTitle}>Cost Calculator</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={colors.background} />
              </TouchableOpacity>
            </View>
            {distance && duration && (
              <View style={styles.tripInfo}>
                <Text style={styles.tripInfoText}>{distance} • {duration}</Text>
              </View>
            )}
          </LinearGradient>

          <View style={styles.calculatorBody}>
            <View style={styles.seatSelectorSection}>
              <Text style={styles.sectionLabel}>Number of Seats</Text>
              <View style={styles.seatButtons}>
                {[1, 2, 3, 4].map((seats) => (
                  <TouchableOpacity
                    key={seats}
                    style={[
                      styles.seatButton,
                      selectedSeats === seats && styles.selectedSeatButton
                    ]}
                    onPress={() => setSelectedSeats(seats)}
                  >
                    <Users
                      size={20}
                      color={selectedSeats === seats ? colors.background : colors.text}
                    />
                    <Text style={[
                      styles.seatButtonText,
                      selectedSeats === seats && styles.selectedSeatButtonText
                    ]}>
                      {seats}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Card style={styles.breakdownCard}>
              <Text style={styles.breakdownTitle}>Cost Breakdown</Text>

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Base Price × {selectedSeats}</Text>
                <Text style={styles.breakdownValue}>${(basePrice / 100).toFixed(2)} × {selectedSeats}</Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Subtotal</Text>
                <Text style={styles.breakdownValue}>${calculations.subtotal.toFixed(2)}</Text>
              </View>

              <View style={styles.breakdownRow}>
                <View style={styles.labelWithInfo}>
                  <Text style={styles.breakdownLabel}>Platform Fee</Text>
                  <Info size={14} color={colors.textSecondary} />
                </View>
                <Text style={styles.breakdownValue}>${calculations.platformFee.toFixed(2)}</Text>
              </View>

              <View style={[styles.breakdownRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${calculations.total.toFixed(2)}</Text>
              </View>
            </Card>

            {selectedSeats > 1 && (
              <>
                <Card style={[styles.savingsCard, { backgroundColor: colors.success + '15' }]}>
                  <View style={styles.savingsHeader}>
                    <TrendingDown size={20} color={colors.success} />
                    <Text style={[styles.savingsTitle, { color: colors.success }]}>
                      Split Payment Savings
                    </Text>
                  </View>
                  <Text style={styles.savingsText}>
                    Each person pays: <Text style={styles.savingsBold}>${calculations.costPerPerson.toFixed(2)}</Text>
                  </Text>
                  <Text style={styles.savingsSubtext}>
                    Save {calculations.savingsPercent.toFixed(0)}% by sharing this ride!
                  </Text>
                </Card>

                <View style={styles.visualSplit}>
                  <Text style={styles.visualSplitLabel}>Payment Split</Text>
                  <View style={styles.splitBars}>
                    {Array.from({ length: selectedSeats }).map((_, index) => (
                      <View key={index} style={styles.splitBarContainer}>
                        <LinearGradient
                          colors={[colors.primary, colors.secondary]}
                          style={styles.splitBar}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <Text style={styles.splitBarText}>
                            ${calculations.costPerPerson.toFixed(2)}
                          </Text>
                        </LinearGradient>
                        <Text style={styles.splitBarLabel}>Person {index + 1}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            )}

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={colors.gradient.cyberpunk}
                style={styles.confirmButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <DollarSign size={20} color={colors.background} />
                <Text style={styles.confirmButtonText}>
                  Book {selectedSeats} Seat{selectedSeats > 1 ? 's' : ''} - ${calculations.total.toFixed(2)}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.background,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripInfo: {
    marginTop: 8,
  },
  tripInfoText: {
    fontSize: 14,
    color: colors.background,
    opacity: 0.9,
  },
  calculatorBody: {
    padding: 24,
  },
  seatSelectorSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 12,
  },
  seatButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  seatButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  selectedSeatButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  seatButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
  },
  selectedSeatButtonText: {
    color: colors.background,
  },
  breakdownCard: {
    marginBottom: 16,
    padding: 20,
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  breakdownLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: colors.text,
  },
  labelWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  totalRow: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.primary,
  },
  savingsCard: {
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.success + '30',
  },
  savingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  savingsTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  savingsText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
  },
  savingsBold: {
    fontWeight: '700' as const,
    color: colors.success,
  },
  savingsSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  visualSplit: {
    marginBottom: 24,
  },
  visualSplitLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 12,
  },
  splitBars: {
    gap: 12,
  },
  splitBarContainer: {
    gap: 6,
  },
  splitBar: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitBarText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.background,
  },
  splitBarLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  confirmButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  confirmButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.background,
  },
});
