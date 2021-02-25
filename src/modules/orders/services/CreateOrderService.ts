import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const checkCustomerExists = await this.customersRepository.findById(
      customer_id,
    );

    if (!checkCustomerExists) {
      throw new AppError('Customer ID not found.');
    }

    const checkProductExists = await this.productsRepository.findAllById(
      products,
    );

    if (!checkProductExists.length) {
      throw new AppError('Products not found.');
    }

    const checkProductIdExists = checkProductExists.map(product => product.id);

    const checkProductIdInexists = products.filter(
      product => !checkProductIdExists.includes(product.id),
    );

    if (checkProductIdInexists.length) {
      throw new AppError(
        `Product ID ${checkProductIdInexists[0].id} not found.`,
      );
    }

    const checkProductQuantity = products.filter(
      product =>
        checkProductExists.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (checkProductQuantity.length) {
      throw new AppError('There is not enough quantity.');
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: checkProductExists.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: checkCustomerExists,
      products: serializedProducts,
    });

    const updateProductQuantity = products.map(product => ({
      id: product.id,
      quantity:
        checkProductExists.filter(p => p.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(updateProductQuantity);

    return order;
  }
}

export default CreateOrderService;
