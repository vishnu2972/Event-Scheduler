import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { SignupDto } from './dtos/signup.dto';
import { LoginDto } from './dtos/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /* ------ Local auth ------ */
  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    return this.auth.signupLocal(dto.email, dto.password, dto.name);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.auth.loginLocal(dto.email, dto.password);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  // This redirects to Google; no handler body needed
  googleLogin() {
    return;
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    // req.user is set by GoogleStrategy.validate()
    const userProfile = req.user as any;
    const user = await this.auth.validateGoogleProfile(userProfile);
    const token = this.auth.signToken(user);

    // Return JSON (easier to copy token for Postman)
    return res.send(token);
  }

  // Optional: quick "whoami" using bearer token
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  me(@Req() req: Request) {
    return req.user; // { sub, email }
  }
}
