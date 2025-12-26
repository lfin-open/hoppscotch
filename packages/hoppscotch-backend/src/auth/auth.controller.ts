import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInMagicDto } from './dto/signin-magic.dto';
import { VerifyMagicDto } from './dto/verify-magic.dto';
import { Response } from 'express';
import * as E from 'fp-ts/Either';
import { RTJwtAuthGuard } from './guards/rt-jwt-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GqlUser } from 'src/decorators/gql-user.decorator';
import { AuthUser } from 'src/types/AuthUser';
import { RTCookie } from 'src/decorators/rt-cookie.decorator';
import { AuthProvider, authCookieHandler, authProviderCheck } from './helper';
import { GoogleSSOGuard } from './guards/google-sso.guard';
import { GithubSSOGuard } from './guards/github-sso.guard';
import { MicrosoftSSOGuard } from './guards/microsoft-sso.guard';
import { FusionAuthSSOGuard } from './guards/fusionauth-sso.guard';
import { ThrottlerBehindProxyGuard } from 'src/guards/throttler-behind-proxy.guard';
import { SkipThrottle } from '@nestjs/throttler';
import { AUTH_PROVIDER_NOT_SPECIFIED } from 'src/errors';
import { ConfigService } from '@nestjs/config';
import { throwHTTPErr } from 'src/utils';
import { UserLastLoginInterceptor } from 'src/interceptors/user-last-login.interceptor';

@UseGuards(ThrottlerBehindProxyGuard)
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Get('providers')
  async getAuthProviders() {
    const providers = await this.authService.getAuthProviders();
    return { providers };
  }

  /**
   ** Route to initiate magic-link auth for a users email
   */
  @Post('signin')
  async signInMagicLink(
    @Body() authData: SignInMagicDto,
    @Query('origin') origin: string,
  ) {
    if (
      !authProviderCheck(
        AuthProvider.EMAIL,
        this.configService.get('INFRA.VITE_ALLOWED_AUTH_PROVIDERS'),
      )
    ) {
      throwHTTPErr({ message: AUTH_PROVIDER_NOT_SPECIFIED, statusCode: 404 });
    }

    const deviceIdToken = await this.authService.signInMagicLink(
      authData.email,
      origin,
    );
    if (E.isLeft(deviceIdToken)) throwHTTPErr(deviceIdToken.left);
    return deviceIdToken.right;
  }

  /**
   ** Route to verify and sign in a valid user via magic-link
   */
  @Post('verify')
  async verify(@Body() data: VerifyMagicDto, @Res() res: Response) {
    const authTokens = await this.authService.verifyMagicLinkTokens(data);
    if (E.isLeft(authTokens)) throwHTTPErr(authTokens.left);
    authCookieHandler(res, authTokens.right, false, null, this.configService);
  }

  /**
   ** Route to refresh auth tokens with Refresh Token Rotation
   * @see https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation
   */
  @Get('refresh')
  @UseGuards(RTJwtAuthGuard)
  async refresh(
    @GqlUser() user: AuthUser,
    @RTCookie() refresh_token: string,
    @Res() res,
  ) {
    const newTokenPair = await this.authService.refreshAuthTokens(
      refresh_token,
      user,
    );
    if (E.isLeft(newTokenPair)) throwHTTPErr(newTokenPair.left);
    authCookieHandler(res, newTokenPair.right, false, null, this.configService);
  }

  /**
   ** Route to initiate SSO auth via Google
   */
  @Get('google')
  @UseGuards(GoogleSSOGuard)
  async googleAuth(@Request() req) {}

  /**
   ** Callback URL for Google SSO
   * @see https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow#how-it-works
   */
  @Get('google/callback')
  @SkipThrottle()
  @UseGuards(GoogleSSOGuard)
  @UseInterceptors(UserLastLoginInterceptor)
  async googleAuthRedirect(@Request() req, @Res() res) {
    const authTokens = await this.authService.generateAuthTokens(req.user.uid);
    if (E.isLeft(authTokens)) throwHTTPErr(authTokens.left);
    authCookieHandler(
      res,
      authTokens.right,
      true,
      req.authInfo.state.redirect_uri,
      this.configService,
    );
  }

  /**
   ** Route to initiate SSO auth via Github
   */
  @Get('github')
  @UseGuards(GithubSSOGuard)
  async githubAuth(@Request() req) {}

  /**
   ** Callback URL for Github SSO
   * @see https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow#how-it-works
   */
  @Get('github/callback')
  @SkipThrottle()
  @UseGuards(GithubSSOGuard)
  @UseInterceptors(UserLastLoginInterceptor)
  async githubAuthRedirect(@Request() req, @Res() res) {
    const authTokens = await this.authService.generateAuthTokens(req.user.uid);
    if (E.isLeft(authTokens)) throwHTTPErr(authTokens.left);
    authCookieHandler(
      res,
      authTokens.right,
      true,
      req.authInfo.state.redirect_uri,
      this.configService,
    );
  }

  /**
   ** Route to initiate SSO auth via Microsoft
   */
  @Get('microsoft')
  @UseGuards(MicrosoftSSOGuard)
  async microsoftAuth(@Request() req) {}

  /**
   ** Callback URL for Microsoft SSO
   * @see https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow#how-it-works
   */
  @Get('microsoft/callback')
  @SkipThrottle()
  @UseGuards(MicrosoftSSOGuard)
  @UseInterceptors(UserLastLoginInterceptor)
  async microsoftAuthRedirect(@Request() req, @Res() res) {
    const authTokens = await this.authService.generateAuthTokens(req.user.uid);
    if (E.isLeft(authTokens)) throwHTTPErr(authTokens.left);
    authCookieHandler(
      res,
      authTokens.right,
      true,
      req.authInfo.state.redirect_uri,
      this.configService,
    );
  }

  /**
   ** Route to initiate SSO auth via FusionAuth
   */
  @Get('fusionauth')
  @UseGuards(FusionAuthSSOGuard)
  async fusionAuth(@Request() req) {}

  /**
   ** Callback URL for FusionAuth SSO
   * @see https://fusionauth.io/docs/lifecycle/authenticate-users/oauth/
   */
  @Get('fusionauth/callback')
  @SkipThrottle()
  @UseGuards(FusionAuthSSOGuard)
  @UseInterceptors(UserLastLoginInterceptor)
  async fusionAuthRedirect(@Request() req, @Res() res) {
    // Decode state parameter to get redirect_uri
    let redirectUri = null;
    try {
      if (req.query.state) {
        const stateData = JSON.parse(
          Buffer.from(req.query.state, 'base64').toString('utf-8'),
        );
        redirectUri = stateData.redirect_uri;
      }
    } catch (error) {
      // Silent fail - will use default redirect
    }

    const authTokens = await this.authService.generateAuthTokens(req.user.uid);
    if (E.isLeft(authTokens)) throwHTTPErr(authTokens.left);
    authCookieHandler(
      res,
      authTokens.right,
      true,
      redirectUri,
      this.configService,
    );
  }

  /**
   ** Log user out by clearing cookies containing auth tokens
   */
  @Get('logout')
  async logout(@Res() res: Response) {
    const cookieOptions = {
      httpOnly: true,
      secure: this.configService.get('INFRA.ALLOW_SECURE_COOKIES') === 'true',
      sameSite: 'lax' as const,
    };

    res.clearCookie('access_token', cookieOptions);
    res.clearCookie('refresh_token', cookieOptions);
    return res.status(200).send();
  }

  /**
   ** Log user out from FusionAuth SSO session
   * This performs a complete logout by:
   * 1. Clearing local Hoppscotch auth cookies
   * 2. Redirecting to FusionAuth logout endpoint to terminate SSO session
   * @see https://fusionauth.io/docs/lifecycle/authenticate-users/oauth/endpoints#logout
   */
  @Get('logout/fusionauth')
  async logoutFusionAuth(
    @Res() res: Response,
    @Query('redirect_uri') redirectUri?: string,
  ) {
    const cookieOptions = {
      httpOnly: true,
      secure: this.configService.get('INFRA.ALLOW_SECURE_COOKIES') === 'true',
      sameSite: 'lax' as const,
    };

    // Clear local cookies first
    res.clearCookie('access_token', cookieOptions);
    res.clearCookie('refresh_token', cookieOptions);

    // Build FusionAuth logout URL
    const fusionAuthBaseUrl = this.configService.get(
      'INFRA.FUSIONAUTH_BASE_URL',
    );
    const clientId = this.configService.get('INFRA.FUSIONAUTH_CLIENT_ID');
    const baseUrl = this.configService.get('VITE_BASE_URL');

    // Build logout URL - only include post_logout_redirect_uri if it's configured in FusionAuth
    // For now, redirect without post_logout_redirect_uri to avoid validation errors
    // Make sure to add the redirect URI in FusionAuth Application settings first
    const logoutUrl = `${fusionAuthBaseUrl}/oauth2/logout?client_id=${clientId}`;

    // Optionally include post_logout_redirect_uri if configured
    // Uncomment this line after adding the URL to FusionAuth Application Logout URL
    // logoutUrl += `&post_logout_redirect_uri=${encodeURIComponent(postLogoutRedirectUri)}`;

    return res.redirect(logoutUrl);
  }

  @Get('verify/admin')
  @UseGuards(JwtAuthGuard)
  async verifyAdmin(@GqlUser() user: AuthUser) {
    const userInfo = await this.authService.verifyAdmin(user);
    if (E.isLeft(userInfo)) throwHTTPErr(userInfo.left);
    return userInfo.right;
  }

  @Get('desktop')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(UserLastLoginInterceptor)
  async desktopAuthCallback(
    @GqlUser() user: AuthUser,
    @Query('redirect_uri') redirectUri: string,
  ) {
    if (!redirectUri || !redirectUri.startsWith('http://localhost')) {
      throwHTTPErr({
        message: 'Invalid desktop callback URL',
        statusCode: 400,
      });
    }

    const tokens = await this.authService.generateAuthTokens(user.uid);
    if (E.isLeft(tokens)) throwHTTPErr(tokens.left);

    return tokens.right;
  }

  @Get('verify-token')
  @UseGuards(JwtAuthGuard)
  async verifyToken(@GqlUser() user: AuthUser) {
    return {
      isValid: true,
      uid: user.uid,
      message: 'Token is valid',
    };
  }
}
