import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { PaymentController } from './payment.controller';

// Regression: VerifyBody once had no validators, so the app's strict global
// ValidationPipe rejected every /payment/verify call and paid orders never landed.
describe('POST /payment/verify body validation', () => {
  const metatype = Reflect.getMetadata(
    'design:paramtypes',
    PaymentController.prototype,
    'verifyPayment',
  )[0];
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    forbidUnknownValues: true,
  });
  const run = (body: object) => pipe.transform(body, { type: 'body', metatype });

  it('accepts the three Razorpay fields', async () => {
    const body = {
      razorpay_order_id: 'order_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'sig',
    };
    await expect(run(body)).resolves.toMatchObject(body);
  });

  it('rejects a missing field', async () => {
    await expect(run({ razorpay_order_id: 'order_1' })).rejects.toBeDefined();
  });
});
