const { Parser } = require('acorn')
const fs = require('fs')
const walk = require('acorn-walk')
const { generate } = require('astring')
const { exit } = require('process')
const axios = require('axios')
const CryptoJS = require('crypto-js')
const AES = require('crypto-js/aes')
const ConfigSchema = require('./models/config')
const Config = require('./models/config')

async function run (url, sources) {
  const cachedApikey = await Config.findOne({ key: 'cachedApikey' })
  if (cachedApikey.value !== undefined && cachedApikey.value !== '') {
    return decrypt(cachedApikey.value, sources)
  }
  let final = ''
  const response = await axios.get(url)
  if (response.status !== 200) {
    return ''
  }
  const parsed = Parser.parse(response.data, {
    ecmaVersion: 6,
    sourceType: 'module',
    // Locations are needed in order for the source map generator to work
    locations: false
  })
  let docHandler
  const dochandlers = []
  walk.ancestor(parsed, {
    Identifier (node, state, ancestors) {
      if (node.name === 'CryptoJS') {
        dochandlers.push(ancestors[2].id.name)
        docHandler = ancestors[2].id.name
      }
    }
  })
  docHandler = dochandlers[0]
  console.log(docHandler)
  let a = {}
  // find the function which generates the api_key
  walk.fullAncestor(parsed,
    (node, callback, base, state) => {
      if (node.type === 'CallExpression') {
        if (node.callee.name === docHandler) {
          a = callback[2]
          final += /* "exports." + */ generate(callback[2]) + ';\n'
        }
      }
    }
  )
  const firstFunctionName = a.id.name
  const foundFuncNames = []
  let arrayName = ''
  let concenatorName = ''
  // find the concenatorName
  walk.simple(a, {
    CallExpression (node) {
      if (node.callee.name === docHandler) {
        const result = node.arguments.find(x => x.type === 'CallExpression' && x.callee.type === 'Identifier')
        if (result) {
          concenatorName = result.callee.name
        }
      }
    }
  })
  // pass in the upper node, now find all of the requirements for it
  function buildNecessary (node) {
    const funcNamesToFind = []
    walk.simple(node, {
      CallExpression (node) {
        if (node.callee.name === 'parseInt' || node.callee.name === 'decodeURIComponent') {
        } else {
          funcNamesToFind.push(node.callee.name)
        }
      }
    })
    for (const d of funcNamesToFind) {
      walk.simple(parsed, {
        FunctionDeclaration (node) {
          if (node.id.name === d) {
            if (!foundFuncNames.includes(d)) {
              foundFuncNames.push(d)
              final += generate(node) + ';\n'
              if (arrayName === '') {
                if (node.body.type === 'BlockStatement') {
                  const result = node.body.body.find(x => x.type === 'VariableDeclaration')
                  if (result) {
                    if (result.declarations[0].init.type === 'ArrayExpression') {
                      arrayName = node.id.name
                    }
                  }
                }
              }
              buildNecessary(node)
            }
          }
        }
      })
    }
  }

  const b = buildNecessary(a) // build the functions for the api key builder
  // find the shuffler which shuffles locations of the strings in main array
  let shuffler = {}
  walk.ancestor(parsed, {
    CallExpression (node, state, ancestors) {
      if (node.arguments.find(x => x.name === arrayName)) {
        shuffler = ancestors[3]
        if (shuffler === undefined) {
          shuffler = ancestors[2]
        }
        final += generate(shuffler) + ';\n'
      }
    }
  })
  // console.log(generate(shuffler))
  buildNecessary(shuffler)
  final += createDochandler(docHandler)
  final += createConcenator(concenatorName)
  final += ';\nreturn ' + firstFunctionName + '(); \n'
  const f = Function(final)
  const decryptionKey = f()[0]
  await Config.updateOne({ key: 'cachedApikey' }, { $set: { value: decryptionKey } })
  console.log('%s | Decryption key: %s', new Date().toISOString(), decryptionKey)
  return decrypt(decryptionKey, sources)
}

function decrypt (key, sources) {
  const result = AES.decrypt(sources, key)
  try {
    const originalText = result.toString(CryptoJS.enc.Utf8)
    console.log(JSON.parse(originalText))
    return JSON.parse(originalText)
  } catch {
    return ''
  }
}

// Finding the entry point of the decryptor function
function createDochandler (funcName) {
  return `const ${funcName} = (a, ...args) => {return args}\n`
}

function createConcenator (funcName) {
  return `const ${funcName} = (...args) => {return args.join('')};\n`
}

function t_start () {
  const start = new Date()
  const hrstart = process.hrtime()
  const simulateTime = 5
  return start, hrstart
}

function t_end (start, hrstart) {
  const end = new Date() - start
  const hrend = process.hrtime(hrstart)
  console.info('Execution time: %dms', end)
  console.info('Execution time (hr): %ds %dms', hrend[0], hrend[1] / 1000000)
}

// run()
module.exports = { run }
