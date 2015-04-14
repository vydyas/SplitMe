'use strict';

var _ = require('underscore');
var moment = require('moment');
var EventEmitter = require('events').EventEmitter;
var Lie = require('lie');

var API = require('../../API');
var utils = require('../../utils');
var dispatcher = require('../dispatcher');
var accountAction = require('../Account/action');

var _expenseOpened = null;
var _expenseCurrent = null;

function getPaidForByContact(contact) {
  return {
    contactId: contact.id, // Reference to a member
    split_equaly: true,
    split_unequaly: null,
    split_shares: 1,
  };
}

function isExpenseValide(expense) {
  if(utils.getExpenseAccountsBalance(expense).length === 0) {
    return false;
  }

  return true;
}

var store = _.extend({}, EventEmitter.prototype, {
  getCurrent: function() {
    return _expenseCurrent;
  },
  save: function(oldExpense, expense) {
    return new Lie(function(resolve) {
      if (oldExpense) { // Already exist
        utils.removeExpenseOfAccounts(oldExpense);
      }

      utils.applyExpenseToAccounts(expense);

      API.putAccountsOfExpense(expense).then(function() {
        API.putExpense(expense).then(function() {
          accountAction.fetchAll();
          resolve();
        });
      });
    });
  },
  remove: function(expense) {
    return new Lie(function(resolve) {
      utils.removeExpenseOfAccounts(expense);

      API.putAccountsOfExpense(expense).then(function() {
        API.removeExpense(expense).then(function() {
          accountAction.fetchAll();
          resolve();
        });
      });
    });
  },
  emitChange: function() {
    this.emit('change');
  },
  addChangeListener: function(callback) {
    this.on('change', callback);
  },
  removeChangeListener: function(callback) {
    this.removeListener('change', callback);
  }
});

/**
 * Register callback to handle all updates
 */
dispatcher.register(function(action) {
  switch(action.actionType) {
    case 'EXPENSE_TAP_CLOSE':
    case 'NAVIGATE_HOME':
    case 'NAVIGATE_ACCOUNT':
      _expenseOpened = null;
      _expenseCurrent = null;
      break;

    case 'EXPENSE_TAP_LIST':
      _expenseOpened = action.expense;
      _expenseCurrent = _.clone(_expenseOpened);
      _expenseCurrent.paidFor = JSON.parse(JSON.stringify(_expenseOpened.paidFor));
      store.emitChange();
      break;

    case 'NAVIGATE_EXPENSE_ADD':
    case 'TAP_ADD_EXPENSE':
    case 'TAP_ADD_EXPENSE_FOR_ACCOUNT':
      if(!_expenseCurrent) {
        _expenseOpened = null;
        _expenseCurrent = {
          description: '',
          amount: null,
          currency: 'EUR',
          date: moment().format('YYYY-MM-DD'),
          type: 'individual',
          paidByContactId: null,
          split: 'equaly',
          paidFor: [],
          accounts: [],
        };

        if (action.account) {
          _expenseCurrent.accounts = [action.account];
          var expenseMembers = utils.getExpenseMembers(_expenseCurrent);

          for (var i = 0; i < expenseMembers.array.length; i++) {
            _expenseCurrent.paidFor.push(getPaidForByContact(expenseMembers.array[i]));
          }
        } else {
          _expenseCurrent.paidFor.push(getPaidForByContact({id: '0'}));
        }

        store.emitChange();
      }
      break;

    case 'EXPENSE_CHANGE_DESCRIPTION':
      _expenseCurrent.description = action.description;
      break;

    case 'EXPENSE_CHANGE_AMOUNT':
      _expenseCurrent.amount = action.amount;
      store.emitChange();
      break;

    case 'EXPENSE_CHANGE_DATE':
      _expenseCurrent.date = action.date;
      store.emitChange();
      break;

    case 'EXPENSE_CHANGE_PAID_BY':
      _expenseCurrent.paidByContactId = action.paidByContactId;
      store.emitChange();
      break;

    case 'EXPENSE_CHANGE_CURRENCY':
      _expenseCurrent.currency = action.currency;
      store.emitChange();
      break;

    case 'EXPENSE_CHANGE_SPLIT':
      _expenseCurrent.split = action.split;
      store.emitChange();
      break;

    case 'EXPENSE_CHANGE_PAID_FOR':
      _expenseCurrent.paidFor = action.paidFor;
      store.emitChange();
      break;

    case 'EXPENSE_PICK_CONTACT':
      var contact = action.contact;

      _expenseCurrent.paidFor.push(getPaidForByContact(contact));

      // Get account
      var promise = new Lie(function(resolve) {
        API.fetchAccountsByMemberId(contact.id).then(function(accounts) {
          if(accounts.length > 0) {
            resolve(accounts[0]);
          } else {
            resolve({
              name: contact.displayName,
              dateLastExpense: null,
              members: [{
                  id: '0',
                  displayName: 'Me',
                },
                contact,
              ],
              expenses: [],
              balances: [],
            });
          }
        });
      });

      promise.then(function(account) {
        _expenseCurrent.accounts.push(account);
        store.emitChange();
      });
      break;

    case 'EXPENSE_TAP_SAVE':
      if (isExpenseValide(_expenseCurrent)) {
        store.save(_expenseOpened, _expenseCurrent).then(function() {
          _expenseOpened = null;
          _expenseCurrent = null;
        }).catch(function(error) {
          console.log(error);
        });
      } else {
        console.log('invalide');
      }
      break;

    case 'MODAL_TAP_OK':
      if (action.triggerName === 'deleteExpenseCurrent') {
        store.remove(_expenseCurrent).then(function() {
          _expenseOpened = null;
          _expenseCurrent = null;
        }).catch(function(error) {
          console.log(error);
        });
      }
      break;

    default:
      // no op
  }
});

module.exports = store;