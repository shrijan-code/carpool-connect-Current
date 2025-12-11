import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {
  BarChart,
  LineChart,
  PieChart,
} from 'react-native-chart-kit';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Award,
  Leaf,
  DollarSign,
  MapPin,
  Clock,
  Users,
  Download,
  Filter,
} from 'lucide-react-native';
import { rideAnalyticsService, RideAnalytics, MonthlyComparison, RideHistoryItem } from '@/services/ride-analytics';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const screenWidth = Dimensions.get('window').width;

interface RideAnalyticsDashboardProps {
  userId: string;
}

export const RideAnalyticsDashboard: React.FC<RideAnalyticsDashboardProps> = ({
  userId,
}) => {
  const [analytics, setAnalytics] = useState<RideAnalytics | null>(null);
  const [monthlyComparison, setMonthlyComparison] = useState<MonthlyComparison | null>(null);
  const [recentRides, setRecentRides] = useState<RideHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [showAchievements, setShowAchievements] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [userId]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [analyticsData, comparisonData, historyData] = await Promise.all([
        rideAnalyticsService.getRideAnalytics(userId),
        rideAnalyticsService.getMonthlyComparison(userId),
        rideAnalyticsService.getRideHistory(userId, 10)
      ]);

      setAnalytics(analyticsData);
      setMonthlyComparison(comparisonData);
      setRecentRides(historyData.rides);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    try {
      const csvData = await rideAnalyticsService.exportRideHistory(userId);
      // In a real app, you'd save this to device or share it
      console.log('CSV Data:', csvData);
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const formatDistance = (distance: number) => `${distance.toFixed(1)} km`;
  const formatPercentage = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

  const getChangeColor = (value: number) => value >= 0 ? '#10B981' : '#EF4444';
  const getChangeIcon = (value: number) => value >= 0 ? TrendingUp : TrendingDown;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner size="large" />
        <Text style={styles.loadingText}>Loading your ride analytics...</Text>
      </View>
    );
  }

  if (!analytics) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Data Available</Text>
        <Text style={styles.emptySubtitle}>Start taking rides to see your analytics</Text>
      </View>
    );
  }

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#3B82F6',
    },
  };

  const monthlyChartData = {
    labels: analytics.monthlyStats.slice(0, 6).reverse().map(stat => 
      new Date(stat.month + '-01').toLocaleDateString('en', { month: 'short' })
    ),
    datasets: [
      {
        data: analytics.monthlyStats.slice(0, 6).reverse().map(stat => stat.rides),
        color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  const dayOfWeekData = {
    labels: analytics.ridesByDay.map(day => day.day.substring(0, 3)),
    datasets: [
      {
        data: analytics.ridesByDay.map(day => day.count),
      },
    ],
  };

  const timePatternData = [
    {
      name: 'Morning',
      count: analytics.timePatterns.morningRides,
      color: '#F59E0B',
      legendFontColor: '#374151',
      legendFontSize: 12,
    },
    {
      name: 'Afternoon',
      count: analytics.timePatterns.afternoonRides,
      color: '#3B82F6',
      legendFontColor: '#374151',
      legendFontSize: 12,
    },
    {
      name: 'Evening',
      count: analytics.timePatterns.eveningRides,
      color: '#8B5CF6',
      legendFontColor: '#374151',
      legendFontSize: 12,
    },
    {
      name: 'Night',
      count: analytics.timePatterns.nightRides,
      color: '#1F2937',
      legendFontColor: '#374151',
      legendFontSize: 12,
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Ride Analytics</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.filterButton}>
            <Filter size={20} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportButton} onPress={handleExportData}>
            <Download size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {(['week', 'month', 'year'] as const).map((period) => (
          <TouchableOpacity
            key={period}
            style={[
              styles.periodButton,
              selectedPeriod === period && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod(period)}
          >
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === period && styles.periodButtonTextActive,
              ]}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Key Metrics */}
      <View style={styles.metricsGrid}>
        <Card style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <MapPin size={20} color="#3B82F6" />
            <Text style={styles.metricLabel}>Total Rides</Text>
          </View>
          <Text style={styles.metricValue}>{analytics.totalRides}</Text>
          {monthlyComparison && (
            <View style={styles.metricChange}>
              {React.createElement(getChangeIcon(monthlyComparison.changes.rides), {
                size: 12,
                color: getChangeColor(monthlyComparison.changes.rides),
              })}
              <Text style={[styles.changeText, { color: getChangeColor(monthlyComparison.changes.rides) }]}>
                {monthlyComparison.changes.rides} this month
              </Text>
            </View>
          )}
        </Card>

        <Card style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <DollarSign size={20} color="#10B981" />
            <Text style={styles.metricLabel}>Total Spent</Text>
          </View>
          <Text style={styles.metricValue}>{formatCurrency(analytics.totalCost)}</Text>
          {monthlyComparison && (
            <View style={styles.metricChange}>
              {React.createElement(getChangeIcon(-monthlyComparison.changes.cost), {
                size: 12,
                color: getChangeColor(-monthlyComparison.changes.cost),
              })}
              <Text style={[styles.changeText, { color: getChangeColor(-monthlyComparison.changes.cost) }]}>
                {formatCurrency(Math.abs(monthlyComparison.changes.cost))} this month
              </Text>
            </View>
          )}
        </Card>

        <Card style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Leaf size={20} color="#059669" />
            <Text style={styles.metricLabel}>CO₂ Saved</Text>
          </View>
          <Text style={styles.metricValue}>{analytics.carbonFootprintSaved.toFixed(1)} kg</Text>
          {monthlyComparison && (
            <View style={styles.metricChange}>
              {React.createElement(getChangeIcon(monthlyComparison.changes.carbonSaved), {
                size: 12,
                color: getChangeColor(monthlyComparison.changes.carbonSaved),
              })}
              <Text style={[styles.changeText, { color: getChangeColor(monthlyComparison.changes.carbonSaved) }]}>
                {monthlyComparison.changes.carbonSaved.toFixed(1)} kg this month
              </Text>
            </View>
          )}
        </Card>

        <Card style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <DollarSign size={20} color="#F59E0B" />
            <Text style={styles.metricLabel}>Money Saved</Text>
          </View>
          <Text style={styles.metricValue}>{formatCurrency(analytics.totalSavings)}</Text>
          <Text style={styles.metricSubtext}>vs. individual rides</Text>
        </Card>
      </View>

      {/* Monthly Trend Chart */}
      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>Rides Over Time</Text>
        <LineChart
          data={monthlyChartData}
          width={screenWidth - 64}
          height={200}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
      </Card>

      {/* Day of Week Chart */}
      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>Rides by Day of Week</Text>
        <BarChart
          data={dayOfWeekData}
          width={screenWidth - 64}
          height={200}
          chartConfig={chartConfig}
          yAxisLabel=""
          yAxisSuffix=""
          style={styles.chart}
        />
      </Card>

      {/* Time Pattern Pie Chart */}
      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>Ride Time Patterns</Text>
        <PieChart
          data={timePatternData}
          width={screenWidth - 64}
          height={200}
          chartConfig={chartConfig}
          accessor="count"
          backgroundColor="transparent"
          paddingLeft="15"
          style={styles.chart}
        />
      </Card>

      {/* Favorite Routes */}
      <Card style={styles.routesCard}>
        <Text style={styles.sectionTitle}>Favorite Routes</Text>
        {analytics.favoriteRoutes.slice(0, 5).map((route, index) => (
          <View key={`${route.route}-${index}`} style={styles.routeItem}>
            <View style={styles.routeInfo}>
              <Text style={styles.routeName}>{route.route}</Text>
              <Text style={styles.routeStats}>
                {route.count} rides • Avg {formatCurrency(route.avgCost)}
              </Text>
            </View>
            <View style={styles.routeBadge}>
              <Text style={styles.routeBadgeText}>{route.count}</Text>
            </View>
          </View>
        ))}
      </Card>

      {/* Achievements */}
      <Card style={styles.achievementsCard}>
        <View style={styles.achievementsHeader}>
          <Text style={styles.sectionTitle}>Achievements</Text>
          <TouchableOpacity onPress={() => setShowAchievements(!showAchievements)}>
            <Text style={styles.viewAllText}>
              {showAchievements ? 'Show Less' : 'View All'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.achievementsGrid}>
          {analytics.achievements
            .slice(0, showAchievements ? undefined : 4)
            .map((achievement) => (
              <View
                key={achievement.id}
                style={[
                  styles.achievementItem,
                  achievement.unlockedAt && styles.achievementUnlocked,
                ]}
              >
                <Text style={styles.achievementIcon}>{achievement.icon}</Text>
                <Text style={styles.achievementTitle}>{achievement.title}</Text>
                <Text style={styles.achievementDescription}>
                  {achievement.description}
                </Text>
                {achievement.target && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(
                              ((achievement.progress || 0) / achievement.target) * 100,
                              100
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {achievement.progress || 0}/{achievement.target}
                    </Text>
                  </View>
                )}
                {achievement.unlockedAt && (
                  <View style={styles.unlockedBadge}>
                    <Award size={12} color="#F59E0B" />
                    <Text style={styles.unlockedText}>Unlocked</Text>
                  </View>
                )}
              </View>
            ))}
        </View>
      </Card>

      {/* Recent Rides */}
      <Card style={styles.recentRidesCard}>
        <Text style={styles.sectionTitle}>Recent Rides</Text>
        {recentRides.slice(0, 5).map((ride) => (
          <View key={ride.id} style={styles.rideItem}>
            <View style={styles.rideDate}>
              <Calendar size={16} color="#6B7280" />
              <Text style={styles.rideDateText}>
                {ride.date.toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.rideDetails}>
              <Text style={styles.rideRoute}>
                {ride.from} → {ride.to}
              </Text>
              <View style={styles.rideStats}>
                <Text style={styles.rideStat}>
                  {formatDistance(ride.distance)}
                </Text>
                <Text style={styles.rideStat}>•</Text>
                <Text style={styles.rideStat}>
                  {formatCurrency(ride.cost)}
                </Text>
                <Text style={styles.rideStat}>•</Text>
                <Text style={[styles.rideStat, { color: ride.status === 'completed' ? '#10B981' : '#EF4444' }]}>
                  {ride.status}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  filterButton: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  exportButton: {
    padding: 8,
    backgroundColor: '#EBF4FF',
    borderRadius: 8,
  },
  periodSelector: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  periodButtonTextActive: {
    color: '#1F2937',
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  metricSubtext: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  metricChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  chartCard: {
    margin: 16,
    padding: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  chart: {
    borderRadius: 8,
  },
  routesCard: {
    margin: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  routeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  routeInfo: {
    flex: 1,
  },
  routeName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  routeStats: {
    fontSize: 12,
    color: '#6B7280',
  },
  routeBadge: {
    backgroundColor: '#EBF4FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  routeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  achievementsCard: {
    margin: 16,
    padding: 16,
  },
  achievementsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  achievementItem: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  achievementUnlocked: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  achievementIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  achievementTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 8,
  },
  progressContainer: {
    gap: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
  },
  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  unlockedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#F59E0B',
  },
  recentRidesCard: {
    margin: 16,
    padding: 16,
    marginBottom: 32,
  },
  rideItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rideDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  rideDateText: {
    fontSize: 12,
    color: '#6B7280',
  },
  rideDetails: {
    gap: 4,
  },
  rideRoute: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  rideStats: {
    flexDirection: 'row',
    gap: 8,
  },
  rideStat: {
    fontSize: 12,
    color: '#6B7280',
  },
});