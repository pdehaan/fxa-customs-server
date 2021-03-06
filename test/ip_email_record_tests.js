/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

require('ass')
var test = require('tap').test
var ipEmailRecord = require('../ip_email_record')

function now() {
  return 1000 // old school
}

function simpleIpEmailRecord() {
  return new (ipEmailRecord(500, 2, now))()
}

test(
  'isBlocked works',
  function (t) {
    var ier = simpleIpEmailRecord()

    t.equal(ier.isBlocked(), false, 'record has never been blocked')
    ier.bk = 499
    t.equal(ier.isBlocked(), false, 'blockedAt is older than block interval')
    ier.bk = 501
    t.equal(ier.isBlocked(), true, 'blockedAt is within the block interval')
    t.end()
  }
)

test(
  'addBadLogin works',
  function (t) {
    var ier = simpleIpEmailRecord()

    t.equal(ier.xs.length, 0, 'record has never had a bad login')
    ier.addBadLogin()
    t.equal(ier.xs.length, 1, 'record has had one bad login')
    ier.addBadLogin()
    ier.addBadLogin()
    t.equal(ier.xs.length, 3, 'record has three bad logins')
    t.end()
  }
)

test(
  'block works',
  function (t) {
    var ier = simpleIpEmailRecord()

    ier.addBadLogin()
    t.equal(ier.isBlocked(), false, 'record is not blocked')
    t.equal(ier.xs.length, 1, 'record has been emailed once')
    ier.block()
    t.equal(ier.isBlocked(), true, 'record is blocked')
    t.equal(ier.xs.length, 0, 'record has an empty list of emails')
    t.end()
  }
)

test(
  'trimBadLogins enforces the bad login limit',
  function (t) {
    var ier = simpleIpEmailRecord()

    t.equal(ier.xs.length, 0, 'record has nothing to trim')
    ier.addBadLogin()
    ier.addBadLogin()
    ier.addBadLogin()
    ier.addBadLogin()
    t.equal(ier.xs.length, 4, 'record contains too many bad logins')
    ier.trimBadLogins(now())
    t.equal(ier.xs.length, 3, 'record has trimmed excess bad logins')
    t.end()
  }
)

test(
  'trimBadLogins evicts expired entries',
  function (t) {
    var ier = simpleIpEmailRecord()

    t.equal(ier.xs.length, 0, 'record has nothing to trim')
    ier.trimBadLogins(now())
    t.equal(ier.xs.length, 0, 'trimming did not do anything')
    ier.xs.push(400)
    ier.xs.push(400)
    ier.xs.push(now())
    t.equal(ier.xs.length, 3, 'record contains expired and fresh logins')
    ier.trimBadLogins(now())
    t.equal(ier.xs.length, 1, 'record has trimmed expired bad logins')
    t.end()
  }
)

test(
  'isOverBadLogins works',
  function (t) {
    var ier = simpleIpEmailRecord()

    t.equal(ier.isOverBadLogins(), false, 'record has never seen bad logins')
    ier.addBadLogin()
    t.equal(ier.isOverBadLogins(), false, 'record has not reached the bad login limit')
    ier.addBadLogin()
    ier.addBadLogin()
    t.equal(ier.isOverBadLogins(), true, 'record has reached the bad login limit')
    t.end()
  }
)

test(
  'retryAfter works',
  function (t) {
    var ier = simpleIpEmailRecord()
    ier.now = function () {
      return 10000
    }

    t.equal(ier.retryAfter(), 0, 'unblocked records can be retried now')
    ier.bk = 100
    t.equal(ier.retryAfter(), 0, 'long expired blocks can be retried immediately')
    ier.bk = 500
    t.equal(ier.retryAfter(), 0, 'just expired blocks can be retried immediately')
    ier.bk = 6000
    t.equal(ier.retryAfter(), 5, 'unexpired blocks can be retried in a bit')
    t.end()
  }
)

test(
  'unblockIfReset works',
  function (t) {
    var ier = simpleIpEmailRecord()

    t.equal(ier.xs.length, 0, 'record does not have any bad logins')
    t.equal(ier.bk, undefined, 'record is not blocked')
    ier.unblockIfReset(now())
    t.equal(ier.xs.length, 0, 'record still does not have any bad logins')
    t.equal(ier.bk, undefined, 'record is still not blocked')
    ier.block()
    ier.addBadLogin()
    t.equal(ier.xs.length, 1, 'record has one bad login')
    t.equal(ier.bk, now(), 'record is blocked')
    ier.unblockIfReset(500)
    t.equal(ier.xs.length, 1, 'bad logins are not cleared when resetting prior to blocking')
    t.equal(ier.bk, now(), 'record is not unblocked when resetting prior to blocking')
    ier.unblockIfReset(2000)
    t.equal(ier.xs.length, 0, 'bad logins are cleared when resetting after blocking')
    t.equal(ier.bk, undefined, 'record is unblocked when resetting after blocking')
    t.end()
  }
)

test(
  'parse works',
  function (t) {
    var ier = simpleIpEmailRecord()
    t.equal(ier.isBlocked(), false, 'original object is not blocked')
    t.equal(ier.xs.length, 0, 'original object has no bad logins')

    var ierCopy1 = (ipEmailRecord(50, 2, now)).parse(ier)
    t.equal(ierCopy1.isBlocked(), false, 'copied object is not blocked')
    t.equal(ierCopy1.xs.length, 0, 'copied object has no bad logins')

    ier.block()
    ier.addBadLogin()
    t.equal(ier.isBlocked(), true, 'original object is now blocked')
    t.equal(ier.xs.length, 1, 'original object now has one bad login')

    var ierCopy2 = (ipEmailRecord(50, 2, now)).parse(ier)
    t.equal(ierCopy2.isBlocked(), true, 'copied object is blocked')
    t.equal(ierCopy2.xs.length, 1, 'copied object has one bad login')
    t.end()
  }
)

test(
  'update works',
  function (t) {
    var ier = simpleIpEmailRecord()

    t.equal(ier.update(), 0, 'undefined action does nothing')
    t.equal(ier.update('bogusAction'), 0, 'bogus action does nothing')
    t.equal(ier.update('accountLogin'), 0, 'login action in a clean account')
    ier.addBadLogin()
    ier.addBadLogin()
    ier.addBadLogin()
    t.equal(ier.isBlocked(), false, 'account is not blocked')
    t.equal(ier.update('accountLogin'), 0, 'action above the login limit')
    t.equal(ier.isBlocked(), true, 'account is now blocked')
    t.equal(ier.update('accountLogin'), 0, 'login action in a blocked account')
    t.end()
  }
)
