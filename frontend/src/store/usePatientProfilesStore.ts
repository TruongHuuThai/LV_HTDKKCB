import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PatientProfilesSelectionState {
  selectedByAccount: Record<string, number>;
  setSelectedProfile: (accountPhone: string, profileId: number) => void;
  clearSelectedProfile: (accountPhone: string) => void;
}

export const usePatientProfilesStore = create<PatientProfilesSelectionState>()(
  persist(
    (set) => ({
      selectedByAccount: {},
      setSelectedProfile: (accountPhone, profileId) =>
        set((state) => ({
          selectedByAccount: {
            ...state.selectedByAccount,
            [accountPhone]: profileId,
          },
        })),
      clearSelectedProfile: (accountPhone) =>
        set((state) => {
          const next = { ...state.selectedByAccount };
          delete next[accountPhone];
          return { selectedByAccount: next };
        }),
    }),
    {
      name: 'umc-patient-profiles',
    },
  ),
);
