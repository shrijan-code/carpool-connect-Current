import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { Booking, User } from '@/types';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#1F4E79' },
  subtitle: { fontSize: 12, marginBottom: 16, color: '#DC2626' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#1F4E79' },
  line: { marginBottom: 4 },
  checkbox: { marginBottom: 2 },
  photo: { width: 120, height: 120, marginTop: 6, objectFit: 'cover' },
});

interface EmergencyPdfDocumentProps {
  booking: Booking;
  traveller: User;
  sender: User;
  documentId: string;
  generatedAt: string;
  appUrl: string;
  emergencyEmail: string;
  emergencyPhone: string;
}

export function EmergencyPdfDocument({
  booking,
  traveller,
  sender,
  documentId,
  generatedAt,
  appUrl,
  emergencyEmail,
  emergencyPhone,
}: EmergencyPdfDocumentProps) {
  const declaration = booking.declarationData;
  const travellerSince = traveller.createdAt?.toDate
    ? traveller.createdAt.toDate().toLocaleDateString('en-AU')
    : 'N/A';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>CarryMate</Text>
        <Text style={styles.subtitle}>CARRIER DOCUMENTATION — FOR LAW ENFORCEMENT</Text>
        <Text style={styles.line}>
          Generated: {generatedAt} | Document ID: {documentId}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SECTION 1: Platform Statement</Text>
          <Text>
            CarryMate is a technology platform that connects independent travellers with people who
            need items delivered between cities. CarryMate is not a courier company and does not
            employ drivers. The person carrying this item is an independent individual, not an
            employee or agent of CarryMate.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SECTION 2: Traveller Information</Text>
          <Text style={styles.line}>Name: {traveller.displayName}</Text>
          <Text style={styles.line}>Verified phone: {traveller.phone}</Text>
          <Text style={styles.line}>CarryMate user since: {travellerSince}</Text>
          <Text style={styles.line}>
            Profile URL: {appUrl}/profile/{traveller.uid}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SECTION 3: Item and Booking Details</Text>
          <Text style={styles.line}>Booking reference: {booking.id}</Text>
          <Text style={styles.line}>Item description: {booking.itemDescription}</Text>
          <Text style={styles.line}>Item category: {booking.itemCategory}</Text>
          {booking.itemPhotoURL ? <Image style={styles.photo} src={booking.itemPhotoURL} /> : null}
          <Text style={styles.line}>
            Booking created:{' '}
            {booking.createdAt?.toDate
              ? booking.createdAt.toDate().toISOString()
              : generatedAt}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SECTION 4: Sender Declaration Record</Text>
          <Text style={styles.line}>Sender name: {sender.displayName}</Text>
          <Text style={styles.line}>
            Declaration signed:{' '}
            {booking.declarationSignedAt?.toDate
              ? booking.declarationSignedAt.toDate().toISOString()
              : declaration?.signedAt ?? 'N/A'}
          </Text>
          <Text style={styles.line}>Digital signature: {declaration?.signedName ?? 'N/A'}</Text>
          <Text style={styles.line}>
            The sender signed a legally binding declaration confirming this item contains no
            illegal, prohibited, or dangerous goods.
          </Text>
          {declaration ? (
            <>
              <Text style={styles.checkbox}>
                {declaration.noDrugs ? '✓' : '✗'} No drugs or controlled substances
              </Text>
              <Text style={styles.checkbox}>
                {declaration.noWeapons ? '✓' : '✗'} No weapons
              </Text>
              <Text style={styles.checkbox}>{declaration.noCash ? '✓' : '✗'} No cash</Text>
              <Text style={styles.checkbox}>
                {declaration.noStolenGoods ? '✓' : '✗'} No stolen goods
              </Text>
              <Text style={styles.checkbox}>
                {declaration.noDangerousGoods ? '✓' : '✗'} No dangerous goods
              </Text>
              <Text style={styles.checkbox}>
                {declaration.noRestrictedItems ? '✓' : '✗'} No restricted items
              </Text>
              <Text style={styles.checkbox}>
                {declaration.descriptionAccurate ? '✓' : '✗'} Description is accurate
              </Text>
              <Text style={styles.checkbox}>
                {declaration.acceptsLiability ? '✓' : '✗'} Accepts liability
              </Text>
            </>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SECTION 5: Platform Contact</Text>
          <Text style={styles.line}>
            CarryMate will cooperate fully with any law enforcement inquiry.
          </Text>
          <Text style={styles.line}>
            Emergency contact: {emergencyEmail} | {emergencyPhone}
          </Text>
          <Text style={styles.line}>
            This document can be verified at: carrymate.com.au/verify/{booking.id}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
