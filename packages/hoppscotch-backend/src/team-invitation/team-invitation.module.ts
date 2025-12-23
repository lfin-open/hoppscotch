import { Module, forwardRef } from '@nestjs/common';
import { TeamModule } from 'src/team/team.module';
import { UserModule } from 'src/user/user.module';
import { UserGroupModule } from 'src/user-group/user-group.module';
import { TeamInvitationResolver } from './team-invitation.resolver';
import { TeamInvitationService } from './team-invitation.service';
import { TeamInviteTeamOwnerGuard } from './team-invite-team-owner.guard';
import { TeamInviteViewerGuard } from './team-invite-viewer.guard';
import { TeamInviteeGuard } from './team-invitee.guard';
import { TeamTeamInviteExtResolver } from './team-teaminvite-ext.resolver';

@Module({
  imports: [TeamModule, UserModule, forwardRef(() => UserGroupModule)],
  providers: [
    TeamInvitationService,
    TeamInvitationResolver,
    TeamTeamInviteExtResolver,
    TeamInviteeGuard,
    TeamInviteViewerGuard,
    TeamInviteTeamOwnerGuard,
  ],
  exports: [TeamInvitationService],
})
export class TeamInvitationModule {}
