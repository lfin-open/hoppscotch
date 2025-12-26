import { Strategy } from 'passport-oauth2';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { UserService } from 'src/user/user.service';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import { ConfigService } from '@nestjs/config';
import { validateEmail } from 'src/utils';
import { AUTH_EMAIL_NOT_PROVIDED_BY_OAUTH } from 'src/errors';

interface FusionAuthUserInfo {
  sub: string;
  email: string;
  email_verified?: boolean;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
}

@Injectable()
export class FusionAuthStrategy extends PassportStrategy(
  Strategy,
  'fusionauth',
) {
  private readonly baseUrl: string;

  constructor(
    private authService: AuthService,
    private usersService: UserService,
    private configService: ConfigService,
  ) {
    const baseUrl = configService.get<string>('INFRA.FUSIONAUTH_BASE_URL');

    super({
      authorizationURL: `${baseUrl}/oauth2/authorize`,
      tokenURL: `${baseUrl}/oauth2/token`,
      clientID: configService.get<string>('INFRA.FUSIONAUTH_CLIENT_ID'),
      clientSecret: configService.get<string>('INFRA.FUSIONAUTH_CLIENT_SECRET'),
      callbackURL: configService.get<string>('INFRA.FUSIONAUTH_CALLBACK_URL'),
      scope:
        configService.get<string>('INFRA.FUSIONAUTH_SCOPE') ||
        'openid profile email',
      passReqToCallback: true,
    });

    this.baseUrl = baseUrl;
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    params: any,
    done: (err: Error | null, user?: any) => void,
  ) {
    try {
      // Fetch user profile from FusionAuth UserInfo endpoint
      const response = await fetch(`${this.baseUrl}/oauth2/userinfo`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new UnauthorizedException(
          'Failed to fetch user info from FusionAuth',
        );
      }

      const userInfo: FusionAuthUserInfo = await response.json();
      const email = userInfo.email;

      if (!validateEmail(email)) {
        throw new UnauthorizedException(AUTH_EMAIL_NOT_PROVIDED_BY_OAUTH);
      }

      // Build profile object compatible with existing createUserSSO method
      const profile = {
        provider: 'fusionauth',
        id: userInfo.sub,
        displayName:
          userInfo.name || userInfo.preferred_username || email.split('@')[0],
        emails: [{ value: email }],
        photos: userInfo.picture ? [{ value: userInfo.picture }] : [],
      };

      const user = await this.usersService.findUserByEmail(email);

      if (O.isNone(user)) {
        const createdUser = await this.usersService.createUserSSO(
          accessToken,
          refreshToken,
          profile,
        );
        return done(null, createdUser);
      }

      // Update displayName and photoURL if they were not set (e.g., magic-link user)
      if (!user.value.displayName || !user.value.photoURL) {
        const updatedUser = await this.usersService.updateUserDetails(
          user.value,
          profile,
        );
        if (E.isLeft(updatedUser)) {
          throw new UnauthorizedException(updatedUser.left);
        }
      }

      // Check if FusionAuth provider account exists for this user
      const providerAccountExists =
        await this.authService.checkIfProviderAccountExists(
          user.value,
          profile,
        );

      if (O.isNone(providerAccountExists)) {
        await this.usersService.createProviderAccount(
          user.value,
          accessToken,
          refreshToken,
          profile,
        );
      }

      return done(null, user.value);
    } catch (error) {
      return done(error as Error, null);
    }
  }
}
