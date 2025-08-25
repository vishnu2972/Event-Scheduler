// src/auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;       // user id
  email: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(cfg: ConfigService) {
    const secret = cfg.get<string>('JWT_SECRET');
    if (!secret) {
      // Fail fast with a helpful message instead of passing undefined
      throw new Error('JWT_SECRET is missing in environment variables');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,      // now definitely a string
      ignoreExpiration: false,  // let passport-jwt enforce exp
      // passReqToCallback is false by default; don't set it here
    });
  }

  // The value returned here becomes req.user
  validate(payload: JwtPayload) {
    return { sub: payload.sub, email: payload.email };
  }
}
