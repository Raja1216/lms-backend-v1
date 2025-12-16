import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class CookieInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const res = context.switchToHttp().getResponse();

    return next.handle().pipe(
      tap((data) => {
        if (data?.data?.access_token) {
          res.cookie('access_token', data.data.access_token, {
            expires: new Date(
              Date.now() +
                Number(process.env.JWT_EXPIRY || 1) *
                  24 *
                  60 *
                  60 *
                  1000,
            ),
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'None',
          });
        }
      }),
    );
  }
}
