const DataLoader = require('dataloader')
const Book = require('../models/book')
const author = require('../models/author')

const bookCountLoader = new DataLoader(async (authorIds) => {
    const counts = await Book.aggregate([
        { $match: { author: { $in: authorIds } } },
        { $group: { _id: '$author', count: { $sum: 1 } } }
    ])

    const countMap = new Map()
    counts.forEach(({ _id, count }) => {
        countMap.set(_id.toString(), count)
    })

    return authorIds.map(id => countMap.get(id.toString()) || 0)
})

module.exports = bookCountLoader