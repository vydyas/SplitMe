import Immutable from 'immutable';
import moment from 'moment';
import {LOCATION_CHANGE} from 'react-router-redux';

import API from 'API';
import accountUtils from 'main/account/utils';
import actionTypes from 'redux/actionTypes';
import routesParser from 'main/routesParser';

function getPaidForByMemberDefault(member) {
  return Immutable.fromJS({
    contactId: member.get('id'), // Reference to a member
    split_equaly: true,
    split_unequaly: null,
    split_shares: 1,
  });
}
function getPaidForByMemberNew(member) {
  return Immutable.fromJS({
    contactId: member.get('id'), // Reference to a member
    split_equaly: false,
    split_unequaly: null,
    split_shares: 0,
  });
}

function setPaidForFromAccount(expense, account) {
  let paidFor = new Immutable.List();

  paidFor = paidFor.withMutations((paidForMutable) => {
    account.get('members').forEach((member) => {
      paidForMutable.push(getPaidForByMemberDefault(member));
    });
  });

  return expense.set('paidFor', paidFor);
}

function reduceRouteEdit(state, id) {
  const account = state.get('accountCurrent');

  if (!account) {
    return state;
  }

  let expense = account.get('expenses').find((expenseCurrent2) => {
    return expenseCurrent2.get('_id') === API.expenseAddPrefixId(id);
  });

  // Need to match, will be often skipped
  if (account.get('members').size !== expense.get('paidFor').size) {
    expense = expense.withMutations((expenseMutable) => {
      account.get('members').forEach((memberCurrent) => {
        const found = expense.get('paidFor').find((item) => {
          return item.get('contactId') === memberCurrent.get('id');
        });

        if (!found) {
          expenseMutable.update('paidFor', (list) => {
            return list.push(getPaidForByMemberNew(memberCurrent));
          });
        }
      });
    });
  }

  expense = expense.set('dateUpdated', moment().unix());

  state = state.set('expenseOpened', expense);
  state = state.set('expenseCurrent', expense);
  return state;
}

function reduceRouteNew(state) {
  state = state.set('expenseOpened', null);

  let expenseCurrent = Immutable.fromJS({
    description: '',
    amount: null,
    currency: 'EUR',
    date: moment().format('YYYY-MM-DD'),
    paidByContactId: null,
    split: 'equaly',
    paidFor: null,
    account: null,
    dateCreated: moment().unix(),
    dateUpdated: moment().unix(),
  });
  expenseCurrent = setPaidForFromAccount(expenseCurrent, state.get('accountCurrent'));

  state = state.set('expenseCurrent', expenseCurrent);

  return state;
}

let account;
let expenseCurrent;

function reducer(state, action) {
  switch (action.type) {
    case actionTypes.EXPENSE_ADD_MEMBER:
      const {
        member,
        useAsPaidBy,
        useForExpense,
      } = action.payload;

      if (useForExpense) {
        if (useAsPaidBy) {
          state = state.setIn(['expenseCurrent', 'paidByContactId'], member.get('id'));
        }
        state = state.updateIn(['expenseCurrent', 'paidFor'], (list) => {
          return list.push(getPaidForByMemberDefault(member));
        });
      }
      return state;

    case actionTypes.EXPENSE_TAP_SAVE:
      if (!action.error) {
        account = action.meta.accountCurrent;

        if (action.meta.expenseOpened) { // Already exist
          account = accountUtils.removeExpenseOfAccount(action.meta.expenseOpened, account);
        }

        account = accountUtils.addExpenseToAccount(action.payload, account);
        account = account.set('dateUpdated', moment().unix());

        state.set('accountCurrent', account);
      }
      return state;

    case actionTypes.EXPENSE_TAP_DELETE:
      account = state.get('accountCurrent');
      account = accountUtils.removeExpenseOfAccount(action.payload.expenseCurrent, account);
      account = account.set('dateUpdated', moment().unix());

      state = state.set('accountCurrent', account);
      return state;

    case actionTypes.EXPENSE_FETCH_ADD:
      if (action.payload && action.payload.expenseId) {
        state = reduceRouteEdit(state, action.payload.expenseId);
      } else {
        state = reduceRouteNew(state);
      }

      return state;

    case LOCATION_CHANGE:
      const location = state.get('routing').locationBeforeTransitions;

      if (location) {
        const pathnameCurrent = location.pathname;
        // Mutation based on where we are now
        if (routesParser.expenseAdd.match(pathnameCurrent) ||
          routesParser.expenseEdit.match(pathnameCurrent)) {
          state = state.set('expenseOpened', null);
          state = state.set('expenseCurrent', null);
        }
      }

      // Mutation based on where we are going
      const pathnameNew = action.payload.pathname;
      if (routesParser.expenseAdd.match(pathnameNew)) {
        if (!state.get('accountCurrent')) {
          return state;
        }

        state = reduceRouteNew(state);
      } else if (routesParser.expenseEdit.match(pathnameNew)) {
        state = reduceRouteEdit(state, routesParser.expenseEdit.match(pathnameNew).expenseId);
      }

      return state;

    case actionTypes.EXPENSE_CHANGE_RELATED_ACCOUNT:
      expenseCurrent = state.get('expenseCurrent');
      expenseCurrent = setPaidForFromAccount(expenseCurrent, state.get('accountCurrent'));
      state = state.set('expenseCurrent', expenseCurrent);
      return state;

    case actionTypes.EXPENSE_CHANGE_PAID_BY:
      state = state.setIn(['expenseCurrent', 'paidByContactId'], action.payload.paidByContactId);
      return state;

    case actionTypes.EXPENSE_CHANGE_PAID_FOR:
      const {
        split,
        index,
      } = action.payload;

      let splitKey;

      switch (split) {
        case 'equaly':
          splitKey = 'split_equaly';
          break;

        case 'unequaly':
          splitKey = 'split_unequaly';
          break;

        case 'shares':
          splitKey = 'split_shares';
          break;
      }

      state = state.setIn(['expenseCurrent', 'paidFor', index, splitKey], action.payload.value);

      return state;

    case actionTypes.EXPENSE_CHANGE_CURRENT:
      const {
        key,
        value,
      } = action.payload;

      state = state.setIn(['expenseCurrent', key], value);
      return state;

    default:
      return state;
  }
}

export default reducer;