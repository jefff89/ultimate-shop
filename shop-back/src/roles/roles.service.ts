import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from './role.entity';
import { Repository } from 'typeorm';
import { User } from 'src/users/user.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  create(name: string) {
    const role = this.roleRepo.create({ name });
    return this.roleRepo.save(role);
  }

  async assign(userId: number, roleId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException('user not found');
    }
    const role = await this.roleRepo.findOneBy({ id: roleId });
    if (!role) {
      throw new NotFoundException('role not found');
    }

    // 4️⃣  Avoid duplicates – this is *O(n)*, fine for a handful of roles
    if (user.roles.some((r) => r.id === role.id)) {
      throw new ConflictException(
        `User #${userId} already has role "${role.name}"`,
      );
    }

    // 5️⃣  Attach & persist
    user.roles.push(role);
    await this.userRepo.save(user); // inserts into user_roles junction table
  }
}
