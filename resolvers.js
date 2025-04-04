const { GraphQLError } = require('graphql')
const jwt = require('jsonwebtoken')
const { PubSub } = require('graphql-subscriptions')
const pubsub = new PubSub()

const Book = require('./models/book')
const Author = require('./models/author')

const resolvers = {
    Query: {
        bookCount: async () => Book.collection.countDocuments(),
        authorCount: async () => Author.collection.countDocuments(),
        allBooks: async (root, args) => {
            console.log('allBooks.args', args)
            let filter = {}

            // If author is given, find their ObjectId
            if (args.author) {
                const author = await Author.findOne({ name: args.author })
                if (!author) {
                    return [] // Return empty array if author is not found
                }
                filter.author = author._id
            }

            // If genre is given, add it to the filter
            if (args.genre) {
                filter.genres = args.genre
            }

            // Fetch books based on the constructed filter
            return await Book.find(filter).populate('author')
        },
        allAuthors: async () => {
            return await Author.find({})
        },
        me: (root, args, context) => {
            return context.currentUser
        },
        allGenres: async () => {
            const books = await Book.find({}, 'genres') // Fetch only genres field
            const genres = books.flatMap(book => book.genres) // Flatten array
            return [...new Set(genres)] // Convert to unique set and back to array
        },
    },
    Author: {
        bookCount: async (author, args, { loaders }) => {
            return loaders.bookCountLoader.load(author._id)
        }
    },
    Mutation: {
        addBook: async (root, args, context) => {

            let author = await Author.findOne({ name: args.author })
            const currentUser = context.currentUser

            if (!currentUser) {
                throw new GraphQLError('not authenticated', {
                    extensions: {
                        code: 'BAD_USER_INPUT'
                    }
                })
            }

            // if author doesn't exist, create a new one
            if (!author) {
                console.log('no author, create one')
                author = new Author({ name: args.author, born: null })
                author.born = null
                try {
                    await author.save()
                } catch (error) {
                    throw new GraphQLError('Saving author failed', {
                        extensions: {
                            code: 'BAD_USER_INPUT',
                            invalidArgs: args.author,
                            errror
                        }
                    })
                }
            }

            console.log('author', author)

            // create a new book with the author's id
            const book = new Book({
                title: args.title,
                published: args.published,
                genres: args.genres,
                author: author._id // reference the author's id
            })

            try {
                await book.save()
            } catch (error) {
                throw new GraphQLError('Saving book failed', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        invalidArgs: args.title,
                        error
                    }
                })
            }

            const populatedBook = await book.populate('author')

            pubsub.publish('BOOK_ADDED', { bookAdded: populatedBook })

            return populatedBook
        },
        editAuthor: async (root, args, context) => {

            const currentUser = context.currentUser

            if (!currentUser) {
                throw new GraphQLError('not authenticated', {
                    extensions: {
                        code: 'BAD_USER_INPUT'
                    }
                })
            }

            let author = await Author.findOne({ name: args.name })

            console.log('args.name')

            if (!author) {
                throw new GraphQLError('Author not found', {
                    extensions: { code: 'BAD_USER_INPUT' }
                });
            }


            // author.born = args.setBornTo;
            author.set('born', args.setBornTo);

            try {
                author.save()
            } catch (error) {
                throw new GraphQLError('Saving born year failed', {
                    extensions: {
                        code: 'BAD_USER_INPUT',
                        invalidArgs: args.name,
                        error
                    }
                })
            }

            return author

        },
        createUser: async (root, args) => {
            const user = User({ username: args.username, favoriteGenre: args.favoriteGenre })

            return user.save()
                .catch(error => {
                    throw new GraphQLError('Creating the user failed', {
                        extensions: {
                            code: 'BAD_USER_INPUT',
                            invalidArgs: args.username,
                            error
                        }
                    })
                })
        },
        login: async (root, args) => {
            const user = await User.findOne({ username: args.username })

            if (!user || args.password !== 'secret') {
                throw new GraphQLError('wrong credentials', {
                    extensions: {
                        code: 'BAD_USER_INPUT'
                    }
                })
            }

            const userForToken = {
                username: user.username,
                id: user._id
            }

            return { value: jwt.sign(userForToken, process.env.JWT_SECRET) }
        }
    },
    Subscription: {
        bookAdded: {
            subscribe: () => pubsub.asyncIterator('BOOK_ADDED')
        }
    }
}

module.exports = resolvers