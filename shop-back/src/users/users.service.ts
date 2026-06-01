import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './user.entity';
import { hashPassword } from './auth/password.util';
@Injectable()
export class UsersService {
  //   repo: Repository<User>;
  //   constructor(repo: Repository<User>) {
  //     this.repo = repo;
  //   }
  // above code is equal to below code
  //   constructor(private repo: Repository<User>) {
  /////////////////////////////////////

  constructor(@InjectRepository(User) private repo: Repository<User>) {}
  create(email: string, password: string) {
    const user = this.repo.create({ email, password });
    // create method makes an instance of the User Entity
    // save method saves that instance in the database
    return this.repo.save(user);
  }
  findOne(id: string) {
    if (!id) {
      return null;
    }
    return this.repo.findOneBy({ id });
  }

  find(email: string) {
    return this.repo.find({ where: { email } });
  }

  async update(id: string, attrs: Partial<User>) {
    // extra trip to the database
    const user = await this.findOne(id);
    if (!user) {
      throw new NotFoundException('user not found');
    }
    // Never persist a raw password: hash it the same way signup does.
    if (attrs.password) {
      attrs = { ...attrs, password: await hashPassword(attrs.password) };
    }
    Object.assign(user, attrs);

    // if we use update or insert method instead of save method, it does not need an extra trip to the database; but the hook in instance would not be run
    return this.repo.save(user);
  }

  async remove(id: string) {
    // extra trip to the database
    const user = await this.findOne(id);
    if (!user) {
      throw new NotFoundException('user not found');
    }
    // if we use delete method instead of remove method, it does not need an extra trip to the database; but the hook in instance would not be run
    return this.repo.remove(user);
  }
}
