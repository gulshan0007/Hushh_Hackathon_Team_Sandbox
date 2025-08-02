import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';

const DemoScreen = () => {
  const handleSurprise = () => {
    Alert.alert(
      '🎉 Surprise! 🎉',
      'You found the hidden Easter egg! 🚀\n\nStay tuned for:\n- AI-powered reminders\n- Smart meeting summaries\n- Voice scheduling\n- Email-to-calendar magic\n- ...and more!'
    );
  };

  return (
    <View style={styles.centeredContainer}>
      <Text style={styles.title}>✨ Demo & Sneak Peek ✨</Text>
      <Text style={styles.subtitle}>This is a demo tab. 🚧</Text>
      <Text style={styles.soon}>More features coming soon!</Text>
      <TouchableOpacity style={styles.surpriseButton} onPress={handleSurprise}>
        <Text style={styles.surpriseButtonText}>Tap for a Surprise 🎁</Text>
      </TouchableOpacity>
      <View style={styles.comingSoonBox}>
        <Text style={styles.comingSoonTitle}>🚀 Upcoming Features</Text>
        <Text style={styles.comingSoonList}>
          • AI-powered reminders{"\n"}
          • Smart meeting summaries{"\n"}
          • Voice scheduling{"\n"}
          • Email-to-calendar magic{"\n"}
          • ...and more!
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#6366F1',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  soon: {
    color: '#10B981',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 18,
    textAlign: 'center',
  },
  surpriseButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    marginBottom: 24,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  surpriseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  comingSoonBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    padding: 20,
    marginTop: 12,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  comingSoonTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6366F1',
    marginBottom: 8,
  },
  comingSoonList: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'left',
    lineHeight: 24,
  },
});

export default DemoScreen;