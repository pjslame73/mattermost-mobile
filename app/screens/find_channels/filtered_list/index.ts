// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {withDatabase, withObservables} from '@nozbe/watermelondb/react';
import {of as of$} from 'rxjs';
import {combineLatestWith, switchMap} from 'rxjs/operators';

import {General} from '@constants';
import {SHOW_USERS_IN_CHANNEL_SEARCH} from '@constants/socratix';
import {observeArchiveChannelsByTerm, observeDirectChannelsByTerm, observeJoinedChannelsByTerm, observeNotDirectChannelsByTerm} from '@queries/servers/channel';
import {observeConfigValue, observeCurrentTeamId} from '@queries/servers/system';
import {queryJoinedTeams} from '@queries/servers/team';
import {observeIsCRTEnabled} from '@queries/servers/thread';
import {observeTeammateNameDisplay} from '@queries/servers/user';
import {removeChannelsFromArchivedTeams, retrieveChannels} from '@screens/find_channels/utils';

import FilteredList, {MAX_RESULTS} from './filtered_list';

import type {WithDatabaseArgs} from '@typings/database/database';
import type UserModel from '@typings/database/models/servers/user';

// Constante de modulo para que el observable no emita un array nuevo por render.
const NO_USERS: UserModel[] = [];

type EnhanceProps = WithDatabaseArgs & {
    term: string;
}

const enhanced = withObservables(['term'], ({database, term}: EnhanceProps) => {
    const teamIds = queryJoinedTeams(database).observe().pipe(
        // eslint-disable-next-line max-nested-callbacks
        switchMap((teams) => of$(new Set(teams.map((t) => t.id)))),
    );
    const joinedChannelsMatchStart = observeJoinedChannelsByTerm(database, term, MAX_RESULTS, true);
    const joinedChannelsMatch = observeJoinedChannelsByTerm(database, term, MAX_RESULTS);
    const directChannelsMatchStart = observeDirectChannelsByTerm(database, term, MAX_RESULTS, true);
    const directChannelsMatch = observeDirectChannelsByTerm(database, term, MAX_RESULTS);

    const channelsMatchStart = joinedChannelsMatchStart.pipe(
        combineLatestWith(directChannelsMatchStart),
        switchMap((matchStart) => {
            return retrieveChannels(database, matchStart.flat(), true);
        }),
        combineLatestWith(teamIds),
        switchMap(([myChannels, tmIds]) => of$(removeChannelsFromArchivedTeams(myChannels, tmIds))),
    );

    const channelsMatch = joinedChannelsMatch.pipe(
        combineLatestWith(directChannelsMatch),
        switchMap((matched) => retrieveChannels(database, matched.flat(), true)),
        combineLatestWith(teamIds),
        switchMap(([myChannels, tmIds]) => of$(removeChannelsFromArchivedTeams(myChannels, tmIds))),
    );

    const archivedChannels = observeArchiveChannelsByTerm(database, term, MAX_RESULTS).pipe(
        switchMap((archived) => retrieveChannels(database, archived)),
    );

    // Se cortan en el origen y no al renderizar: `totalLocalResults` cuenta
    // `usersMatchStart` para decidir si vale la pena la busqueda remota de
    // canales, asi que filtrar mas abajo dejaria a un dispositivo con la cache
    // sucia sin poder encontrar sus cursos.
    const usersMatchStart = SHOW_USERS_IN_CHANNEL_SEARCH ? observeNotDirectChannelsByTerm(database, term, MAX_RESULTS, true) : of$(NO_USERS);
    const usersMatch = SHOW_USERS_IN_CHANNEL_SEARCH ? observeNotDirectChannelsByTerm(database, term, MAX_RESULTS) : of$(NO_USERS);

    const restrictDirectMessage = observeConfigValue(database, 'RestrictDirectMessage').pipe(
        switchMap((v) => of$(v !== General.RESTRICT_DIRECT_MESSAGE_ANY)),
    );

    const teammateDisplayNameSetting = observeTeammateNameDisplay(database);

    return {
        archivedChannels,
        channelsMatch,
        channelsMatchStart,
        currentTeamId: observeCurrentTeamId(database),
        isCRTEnabled: observeIsCRTEnabled(database),
        restrictDirectMessage,
        showTeamName: teamIds.pipe(switchMap((ids) => of$(ids.size > 1))),
        teamIds,
        teammateDisplayNameSetting,
        usersMatchStart,
        usersMatch,
    };
});

export default withDatabase(enhanced(FilteredList));
