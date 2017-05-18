'use strict';

exports.detail = async(ctx) => {
  const userId = ctx.params.userId;

  const account = await ctx.app.model.Account.getAccountById(userId);
  account.balance = account.balance.toFixed(4);
  account.consumption = account.consumption.toFixed(4);
  if (!account) {
    ctx.throw(404);
  } else {
    ctx.body = account;
  }
};

exports.charge = async(ctx) => {
  const userId = ctx.params.userId;
  const body = ctx.request.body;
  const addValue = parseFloat(body.value, 10);
  if (isNaN(addValue)) {
    ctx.throw(400, 'The value should be a valid number');
    return;
  }

  const query = {
    "amount": addValue,
    "user_id": userId,
  };

  if (body.type && body.come_from) {
    query.type = body.type;
    query.come_from = body.come_from;
  } else {
    query.operator = ctx.user.id;
  }

  // TODO: May need to lock the table.
  const chargeRec = await ctx.app.model.Charge.create(query);

  if (chargeRec) {
    const account = await ctx.app.model.Account.getAccountById(userId);
    if (!account.balance) {
      account.balance = addValue;
    } else {
      account.balance += addValue;
    }
    account.save();
  }
  ctx.body = {
    "message": "Done",
  };

}

exports.list = async(ctx) => {
  const accounts = await ctx.app.model.Account.listAccounts();
  accounts.forEach(account => {
    account.balance = account.balance.toFixed(4);
    account.consumption = account.consumption.toFixed(4);
  });
  ctx.body = {
    accounts: accounts
  };
};

exports.create = async(ctx) => {
  if (!ctx.isAdmin) {
    ctx.throw(409);
  }
  const body = ctx.request.body;

  ctx.body = {};
};