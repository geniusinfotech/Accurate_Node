import { SalesService } from './sales.service';

/**
 * Bill numbers used to come from a count of the sales dated today, which
 * collided with the unique saleNumber index as soon as a bill was back-dated
 * or deleted. These cover the sequence source rather than the whole create().
 */
const createService = (issuedSaleNumbers: string[]) => {
  const saleModel: any = {
    find: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest
        .fn()
        .mockResolvedValue(issuedSaleNumbers.map((saleNumber) => ({ saleNumber }))),
    })),
  };

  const service = new SalesService(
    saleModel,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  return { service, saleModel };
};

const prefixFor = (date = new Date()) => {
  const year = date.getFullYear();
  const diwaliYear = date < new Date(year, 10, 1) ? year - 1 : year;
  const mmdd =
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');
  return `SALE-${diwaliYear}-${mmdd}-`;
};

describe('SalesService bill numbering', () => {
  it('starts at 0001 when nothing has been issued today', async () => {
    const { service } = createService([]);

    const { saleNumber } = await service.getNextSaleNumber();

    expect(saleNumber).toBe(`${prefixFor()}0001`);
  });

  it('continues from the highest number already issued', async () => {
    const prefix = prefixFor();
    const { service } = createService([
      `${prefix}0001`,
      `${prefix}0002`,
      `${prefix}0003`,
    ]);

    const { saleNumber } = await service.getNextSaleNumber();

    expect(saleNumber).toBe(`${prefix}0004`);
  });

  it('does not reuse a number after a bill in the middle is deleted', async () => {
    const prefix = prefixFor();
    // 0002 was deleted, so a count-based sequence would hand out 0003 again.
    const { service } = createService([`${prefix}0001`, `${prefix}0003`]);

    const { saleNumber } = await service.getNextSaleNumber();

    expect(saleNumber).toBe(`${prefix}0004`);
  });

  it('matches on the number prefix, not the sale date', async () => {
    const prefix = prefixFor();
    const { service, saleModel } = createService([`${prefix}0007`]);

    const { saleNumber } = await service.getNextSaleNumber();

    // A back-dated bill still counts, because the query keys off saleNumber.
    expect(saleModel.find).toHaveBeenCalledWith({
      saleNumber: { $regex: `^${prefix}\\d+$` },
    });
    expect(saleNumber).toBe(`${prefix}0008`);
  });
});
