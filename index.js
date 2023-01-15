const { getDataAccount, getDataProduct, getDataOperator, checkNumberStatus, createOrder, resendOrder } = require('wnrstore-api')
const telegramBot = require('node-telegram-bot-api')
const toRupiah = require('@develoka/angka-rupiah-js')

// Telegram Bot Token
const token = '5976724884:xxxxxxxxx-U'
const bot = new telegramBot(token, { polling: true })

// WNRStore API Key
const wnrstore_api = 'xxxxxxxx'

// Global Data
let globalDataProduct = [], globalDataOperator = []

// Command
const command = {
  'init': '[INIT] digunakan untuk menginisialisasi data produk layanan dan operator\nFormat perintah : /init',
  'info': '[INFO] digunakan untuk menampilkan informasi akun wnrstore.com.\nFormat perintah : /info',
  'list_product': '[LIST_PRODUCT] digunakan untuk menampilkan informasi daftar produk yang dijual.\nFormat perintah : /list_product',
  'list_operator': '[LIST_OPERATOR] digunakan untuk menampilkan informasi daftar operator yang tersedia.\nFormat perintah : /list_operator',
  'create': '[CREATE] digunakan untuk membeli nomor otp.\nFormat perintah : /create(spasi)(operator)(spasi)(produk)\nContoh perintah : /create telkomsel bukalapak',
  'check': '[CHECK] digunakan untuk mengecek status nomor otp.\nFormat perintah : /check(spasi)(nomor_hp)\nContoh perintah : /check 628xxx',
  'resend': '[RESEND] digunakan untuk menerima nomor otp lebih dari 1 (satu) kali.\nFormat perintah : /resend(spasi)(nomor_hp)\nContoh perintah : /resend 628xxx'
}

// Message Handling
bot.on('message', async (msg) => {
  const chatId = msg.chat.id
  const chattText = msg.text
  try {
    // --- [ Init Data ] ----
    if (chattText.match(/\/init/gi)) {
      const resDataProduct = await getDataProduct(wnrstore_api)
      const resDataOperator = await getDataOperator(wnrstore_api)
      if (resDataProduct.success && resDataOperator.success) {
        globalDataProduct = resDataProduct.data
        globalDataOperator = resDataOperator.data
        const messageFormat = `Inisialisasi data berhasil`
        bot.sendMessage(chatId, messageFormat)
      } else {
        throw new Error('Gagal mengambil data produk dan operator')
      }
    }
    // --- [ Command ] ----
    else if (chattText.match(/\/command/gi)) {
      const messageCommand = Object.values(command).map((data, index) => { return `(${index + 1}) ${data}` }).join('\n\n')
      const messageFormat = `Berikut daftar operator yang tersedia :\n\n${messageCommand}`
      bot.sendMessage(chatId, messageFormat)
    }
    if (globalDataProduct.length > 0 && globalDataOperator.length > 0) {
      // --- [ Check Account Info ] ----
      if (chattText.match(/\/info/gi)) {
        const resDataInfo = await getDataAccount(wnrstore_api)
        if (resDataInfo.success) {
          const { fullname, username, email, balance } = resDataInfo.data
          const messageFormat = `Berikut informasi akun anda :\n\n(+) Nama Lengkap : ${fullname}\n(+) Username : ${username}\n(+) Email : ${email}\n(+) Saldo : ${toRupiah(balance, { floatingPoint: 0 })}`
          bot.sendMessage(chatId, messageFormat)
        } else {
          throw new Error(resDataInfo.message)
        }
      }
      // --- [ Show List Product ] ----
      else if (chattText.match(/\/list_product/gi)) {
        const messageProduct = globalDataProduct.map((data, index) => { return `(${index + 1}) ${data.name}` }).join('\n')
        const messageFormat = `Berikut daftar produk layanan :\n\n${messageProduct}`
        bot.sendMessage(chatId, messageFormat)
      }
      // --- [ Show List Operator ] ----
      else if (chattText.match(/\/list_operator/gi)) {
        const messageOperator = globalDataOperator.map((data, index) => { return `(${index + 1}) ${data.name}` }).join('\n')
        const messageFormat = `Berikut daftar operator yang tersedia :\n\n${messageOperator}`
        bot.sendMessage(chatId, messageFormat)
      }
      // --- [ Create New Order ] ----
      else if (chattText.match(/\/create/gi)) {
        const [, operatorParam, productParams] = chattText.split(' ')
        if (operatorParam && productParams) {
          const filterDataOperator = globalDataOperator.filter(data => data.name.toLowerCase() === operatorParam.toLowerCase())
          const filterDataProduct = globalDataProduct.filter(data => data.name.toLowerCase() === productParams.toLowerCase())
          if (filterDataOperator.length > 0 && filterDataProduct.length > 0) {
            const { id: operatorId, name: operatorName } = filterDataOperator[0]
            const { id: productId, name: productName } = filterDataProduct[0]
            const resOrderOTP = await createOrder(wnrstore_api, productId, operatorId)
            if (resOrderOTP.success) {
              const messageFormat = `Order OTP Berhasil !\n(+) Nomor : ${resOrderOTP.data.phone_number} (${operatorName})\n(+) Produk : ${productName})`
              bot.sendMessage(chatId, messageFormat)
            } else {
              throw new Error(resOrderOTP.message)
            }
          } else {
            throw new Error(`Nama operator atau nama layanan tidak valid`)
          }
        } else {
          throw new Error(`Silahkan isi parameter operator dan produk\n\nReferensi :\n${command['create']}`)
        }
      }
      // --- [ Resend Order ] ----
      else if (chattText.match(/\/resend/gi)) {
        const [, numberParam] = chattText.split(' ')
        if (numberParam) {
          const resDataNumber = await checkNumberStatus(wnrstore_api, numberParam)
          if (resDataNumber.success) {
            if (resDataNumber.data.data.length > 0) {
              const { id } = resDataNumber.data.data[0]
              const resResendOTP = await resendOrder(wnrstore_api, id)
              const messageFormat = `Resend "${numberParam}" Sukses !`
              bot.sendMessage(chatId, messageFormat)
            } else {
              throw new Error('Data tidak ditemukan')
            }
          } else {
            throw new Error(resDataNumber.message)
          }
        } else {
          throw new Error(`Silahkan isi parameter nomor\n\nReferensi :\n${command['resend']}`)
        }
      }
      // --- [ Check Order ] ----
      else if (chattText.match(/\/check/gi)) {
        const [, numberParam] = chattText.split(' ')
        if (numberParam) {
          const resDataNumber = await checkNumberStatus(wnrstore_api, numberParam)
          if (resDataNumber.success) {
            if (resDataNumber.data.data.length > 0) {
              const { status, phone_message } = resDataNumber.data.data[0]
              const messageOrder = `(+) Nomor HP : ${numberParam}\n(+) Status : ${status}\n(+) Pesan : ${phone_message || '-'}`
              const messageFormat = `Berikut informasi nomor anda :\n\n${messageOrder}`
              bot.sendMessage(chatId, messageFormat)
            } else {
              throw new Error('Data tidak ditemukan')
            }
          } else {
            throw new Error(resDataNumber.message)
          }
        } else {
          throw new Error(`Silahkan isi parameter nomor\n\nReferensi :\n${command['check']}`)
        }
      }
    } else {
      throw new Error('Silahkan jalankan perintah /init terlebih dahulu')
    }
  } catch (err) {
    bot.sendMessage(chatId, `[ERROR] ${err.message}`)
  }
})