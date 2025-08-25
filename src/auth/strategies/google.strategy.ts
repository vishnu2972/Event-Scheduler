// src/auth/strategies/google.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(cfg: ConfigService) {
    super({
      clientID: cfg.get<string>('GOOGLE_CLIENT_ID')!,      // non-null assertion
      clientSecret: cfg.get<string>('GOOGLE_CLIENT_SECRET')!,
      callbackURL: cfg.get<string>('GOOGLE_CALLBACK_URL')!,
      scope: ['email', 'profile'],
      // passReqToCallback: false,  // <-- remove this line
    });
  }

  // No req here (matches StrategyOptions)
  validate(_accessToken: string, _refreshToken: string, profile: Profile) {
    const email = profile.emails?.[0]?.value;
    return {
      provider: 'google' as const,
      providerId: profile.id,
      email,
      name: profile.displayName,
      picture: profile.photos?.[0]?.value,
    };
  }
}
