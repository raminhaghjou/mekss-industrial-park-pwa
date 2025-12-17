import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../shared/services/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'mekss-secret',
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        managedFactories: true,
        managedParks: true,
      },
    });

    if (!user) {
      return null;
    }

    if (!user.isActive) {
      return null;
    }

    return {
      id: user.id,
      phoneNumber: user.phoneNumber,
      name: user.name,
      role: user.role,
      factoryId: user.managedFactories?.[0]?.id,
      parkId: user.managedParks?.[0]?.id,
    };
  }
}