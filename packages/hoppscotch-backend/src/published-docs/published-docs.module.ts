import { Module, forwardRef } from '@nestjs/common';
import { PublishedDocsResolver } from './published-docs.resolver';
import { PublishedDocsService } from './published-docs.service';
import { TeamModule } from 'src/team/team.module';
import { UserGroupModule } from 'src/user-group/user-group.module';
import { PublishedDocsController } from './published-docs.controller';
import { UserCollectionModule } from 'src/user-collection/user-collection.module';
import { TeamCollectionModule } from 'src/team-collection/team-collection.module';

@Module({
  imports: [
    UserCollectionModule,
    TeamModule,
    TeamCollectionModule,
    forwardRef(() => UserGroupModule),
  ],
  controllers: [PublishedDocsController],
  providers: [PublishedDocsResolver, PublishedDocsService],
})
export class PublishedDocsModule {}
