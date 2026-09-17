import {ProfileStore} from '@soul/raid/profile';
import {RaidSession} from '@soul/raid';
import {chooseMonsterSpecies} from '@soul/raid/species';
import {withHuntProfile} from './profile-store.js';
import {withHuntSession} from './session-loop.js';

export const HuntProfileStore = withHuntProfile(ProfileStore);
export const HuntSession = withHuntSession(RaidSession, chooseMonsterSpecies);
