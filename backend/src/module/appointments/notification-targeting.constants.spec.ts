import {
  BULK_NOTIFICATION_RECIPIENT_SCOPE,
  BULK_NOTIFICATION_RECIPIENT_SCOPE_VALUES,
  BULK_NOTIFICATION_TARGET_GROUP,
  BULK_NOTIFICATION_TARGET_GROUP_VALUES,
} from './notification-targeting.constants';

describe('notification targeting constants', () => {
  it('contains supported target groups', () => {
    expect(BULK_NOTIFICATION_TARGET_GROUP_VALUES).toEqual(
      expect.arrayContaining([
        BULK_NOTIFICATION_TARGET_GROUP.ALL_USERS,
        BULK_NOTIFICATION_TARGET_GROUP.PATIENTS,
        BULK_NOTIFICATION_TARGET_GROUP.DOCTORS,
        BULK_NOTIFICATION_TARGET_GROUP.BY_SPECIALTY,
        BULK_NOTIFICATION_TARGET_GROUP.ADVANCED_FILTER,
      ]),
    );
  });

  it('contains supported recipient scopes', () => {
    expect(BULK_NOTIFICATION_RECIPIENT_SCOPE_VALUES).toEqual(
      expect.arrayContaining([
        BULK_NOTIFICATION_RECIPIENT_SCOPE.ALL_USERS,
        BULK_NOTIFICATION_RECIPIENT_SCOPE.PATIENTS,
        BULK_NOTIFICATION_RECIPIENT_SCOPE.DOCTORS,
      ]),
    );
  });
});

