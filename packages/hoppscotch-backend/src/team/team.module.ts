import { Module, forwardRef } from '@nestjs/common';
import { TeamService } from './team.service';
import { TeamResolver } from './team.resolver';
import { UserModule } from '../user/user.module';
import { TeamMemberResolver } from './team-member.resolver';
import { GqlTeamMemberGuard } from './guards/gql-team-member.guard';
import { UserGroupModule } from '../user-group/user-group.module';

@Module({
  imports: [UserModule, forwardRef(() => UserGroupModule)],
  providers: [
    TeamService,
    TeamResolver,
    TeamMemberResolver,
    GqlTeamMemberGuard,
  ],
  exports: [TeamService, GqlTeamMemberGuard],
})
export class TeamModule {}
