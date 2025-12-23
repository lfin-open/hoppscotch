import { Module, forwardRef } from '@nestjs/common';
import { TeamCollectionService } from './team-collection.service';
import { TeamCollectionResolver } from './team-collection.resolver';
import { GqlCollectionTeamMemberGuard } from './guards/gql-collection-team-member.guard';
import { TeamModule } from '../team/team.module';
import { UserModule } from '../user/user.module';
import { UserGroupModule } from '../user-group/user-group.module';
import { TeamCollectionController } from './team-collection.controller';

@Module({
  imports: [TeamModule, UserModule, forwardRef(() => UserGroupModule)],
  providers: [
    TeamCollectionService,
    TeamCollectionResolver,
    GqlCollectionTeamMemberGuard,
  ],
  exports: [TeamCollectionService, GqlCollectionTeamMemberGuard],
  controllers: [TeamCollectionController],
})
export class TeamCollectionModule {}
