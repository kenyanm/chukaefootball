import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export const TOURNAMENT_DEFAULTS = {
  ENTRY_FEE: 20, // KSh 20
  PAYMENT_DESTINATION: '0111359682', // Official M-Pesa payment destination
  ADMIN_WHATSAPP_PHONE: '0180752220', // Admin WhatsApp for 24-hour payment escalation
  ADMIN_WHATSAPP_URL: 'https://wa.me/254180752220',
  ORGANIZER_NAME: 'Admin Laurence Wayongo',
  CHAMPION_PRIZE: 1000, // KSh 1,000
  ROOM_JOIN_WINDOW_MINUTES: 5, // 5 minutes preparation / join window for Away player
  PRIMARY_ADMIN_EMAIL: 'wayongohlaurence@gmail.com', // Sole authorized administrator
  WHATSAPP_COMMUNITY_URL: 'https://chat.whatsapp.com/DYZn4PtKAp1AeANEuPVffk',
  PLATFORM_TITLE: 'CHUKA eFOOTBALL',
  GAME_TITLE: 'eFootball™ Mobile',
  MAX_PLAYERS: 1024,
};

export interface TournamentConfigData {
  entryFee: number;
  paymentDestination: string;
  championPrize: number;
  roomJoinWindowMinutes: number;
  adminEmail: string;
  whatsappCommunityUrl: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const tournamentConfigService = {
  async getConfig(): Promise<TournamentConfigData> {
    try {
      const configDoc = await getDoc(doc(db, 'settings', 'tournamentConfig'));
      if (configDoc.exists()) {
        const data = configDoc.data();
        return {
          entryFee: data.entryFee ?? TOURNAMENT_DEFAULTS.ENTRY_FEE,
          paymentDestination: data.paymentDestination ?? TOURNAMENT_DEFAULTS.PAYMENT_DESTINATION,
          championPrize: data.championPrize ?? TOURNAMENT_DEFAULTS.CHAMPION_PRIZE,
          roomJoinWindowMinutes: data.roomJoinWindowMinutes ?? TOURNAMENT_DEFAULTS.ROOM_JOIN_WINDOW_MINUTES,
          adminEmail: data.adminEmail ?? TOURNAMENT_DEFAULTS.PRIMARY_ADMIN_EMAIL,
          whatsappCommunityUrl: data.whatsappCommunityUrl ?? TOURNAMENT_DEFAULTS.WHATSAPP_COMMUNITY_URL,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
        };
      }
    } catch (e) {
      console.warn('Using default tournament configuration:', e);
    }
    return {
      entryFee: TOURNAMENT_DEFAULTS.ENTRY_FEE,
      paymentDestination: TOURNAMENT_DEFAULTS.PAYMENT_DESTINATION,
      championPrize: TOURNAMENT_DEFAULTS.CHAMPION_PRIZE,
      roomJoinWindowMinutes: TOURNAMENT_DEFAULTS.ROOM_JOIN_WINDOW_MINUTES,
      adminEmail: TOURNAMENT_DEFAULTS.PRIMARY_ADMIN_EMAIL,
      whatsappCommunityUrl: TOURNAMENT_DEFAULTS.WHATSAPP_COMMUNITY_URL,
    };
  },

  async updateConfig(
    newConfig: Partial<TournamentConfigData>,
    adminUid: string
  ): Promise<void> {
    const ref = doc(db, 'settings', 'tournamentConfig');
    await setDoc(
      ref,
      {
        ...newConfig,
        updatedAt: new Date().toISOString(),
        updatedBy: adminUid,
      },
      { merge: true }
    );
  },
};
