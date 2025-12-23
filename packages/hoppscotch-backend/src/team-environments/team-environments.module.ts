import { Module, forwardRef } from '@nestjs/common';
import { TeamEnvironmentsService } from './team-environments.service';
import { TeamEnvironmentsResolver } from './team-environments.resolver';
import { UserModule } from 'src/user/user.module';
import { TeamModule } from 'src/team/team.module';
import { UserGroupModule } from 'src/user-group/user-group.module';
import { GqlTeamEnvTeamGuard } from './gql-team-env-team.guard';
import { TeamEnvsTeamResolver } from './team.resolver';

@Module({
  imports: [UserModule, TeamModule, forwardRef(() => UserGroupModule)],
  providers: [
    TeamEnvironmentsResolver,
    TeamEnvironmentsService,
    GqlTeamEnvTeamGuard,
    TeamEnvsTeamResolver,
  ],
  exports: [TeamEnvironmentsService, GqlTeamEnvTeamGuard],
})
export class TeamEnvironmentsModule {}
