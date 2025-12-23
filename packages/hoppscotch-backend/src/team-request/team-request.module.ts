import { Module, forwardRef } from '@nestjs/common';
import { TeamRequestService } from './team-request.service';
import { TeamRequestResolver } from './team-request.resolver';
import { TeamModule } from '../team/team.module';
import { TeamCollectionModule } from '../team-collection/team-collection.module';
import { UserGroupModule } from '../user-group/user-group.module';
import { GqlRequestTeamMemberGuard } from './guards/gql-request-team-member.guard';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TeamModule,
    TeamCollectionModule,
    UserModule,
    forwardRef(() => UserGroupModule),
  ],
  providers: [
    TeamRequestService,
    TeamRequestResolver,
    GqlRequestTeamMemberGuard,
  ],
  exports: [TeamRequestService, GqlRequestTeamMemberGuard],
})
export class TeamRequestModule {}
