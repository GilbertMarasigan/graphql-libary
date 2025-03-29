const { ApolloServer } = require('@apollo/server')
const { startStandaloneServer } = require('@apollo/server/standalone')
const { v1: uuid } = require('uuid')
const { GraphQLError } = require('graphql')
const mongoose = require('mongoose')

mongoose.set('strictQuery', false)

const Book = require('./models/book')
const Author = require('./models/author')

require('dotenv').config()

const MONGODB_URI = process.env.MONGODB_URI

console.log('connecting to', MONGODB_URI)

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('connected to MongoDB')
    })
    .catch(() => {
        console.log('error connection to MongoDB:', error.message)
    })


let authors = [
    {
        name: 'Robert Martin',
        id: "afa51ab0-344d-11e9-a414-719c6709cf3e",
        born: 1952,
    },
    {
        name: 'Martin Fowler',
        id: "afa5b6f0-344d-11e9-a414-719c6709cf3e",
        born: 1963
    },
    {
        name: 'Fyodor Dostoevsky',
        id: "afa5b6f1-344d-11e9-a414-719c6709cf3e",
        born: 1821
    },
    {
        name: 'Joshua Kerievsky', // birthyear not known
        id: "afa5b6f2-344d-11e9-a414-719c6709cf3e",
    },
    {
        name: 'Sandi Metz', // birthyear not known
        id: "afa5b6f3-344d-11e9-a414-719c6709cf3e",
    },
]

/*
 * Suomi:
 * Saattaisi olla järkevämpää assosioida kirja ja sen tekijä tallettamalla kirjan yhteyteen tekijän nimen sijaan tekijän id
 * Yksinkertaisuuden vuoksi tallennamme kuitenkin kirjan yhteyteen tekijän nimen
 *
 * English:
 * It might make more sense to associate a book with its author by storing the author's id in the context of the book instead of the author's name
 * However, for simplicity, we will store the author's name in connection with the book
 *
 * Spanish:
 * Podría tener más sentido asociar un libro con su autor almacenando la id del autor en el contexto del libro en lugar del nombre del autor
 * Sin embargo, por simplicidad, almacenaremos el nombre del autor en conexión con el libro
*/

let books = [
    {
        title: 'Clean Code',
        published: 2008,
        author: 'Robert Martin',
        id: "afa5b6f4-344d-11e9-a414-719c6709cf3e",
        genres: ['refactoring']
    },
    {
        title: 'Agile software development',
        published: 2002,
        author: 'Robert Martin',
        id: "afa5b6f5-344d-11e9-a414-719c6709cf3e",
        genres: ['agile', 'patterns', 'design']
    },
    {
        title: 'Refactoring, edition 2',
        published: 2018,
        author: 'Martin Fowler',
        id: "afa5de00-344d-11e9-a414-719c6709cf3e",
        genres: ['refactoring']
    },
    {
        title: 'Refactoring to patterns',
        published: 2008,
        author: 'Joshua Kerievsky',
        id: "afa5de01-344d-11e9-a414-719c6709cf3e",
        genres: ['refactoring', 'patterns']
    },
    {
        title: 'Practical Object-Oriented Design, An Agile Primer Using Ruby',
        published: 2012,
        author: 'Sandi Metz',
        id: "afa5de02-344d-11e9-a414-719c6709cf3e",
        genres: ['refactoring', 'design']
    },
    {
        title: 'Crime and punishment',
        published: 1866,
        author: 'Fyodor Dostoevsky',
        id: "afa5de03-344d-11e9-a414-719c6709cf3e",
        genres: ['classic', 'crime']
    },
    {
        title: 'Demons',
        published: 1872,
        author: 'Fyodor Dostoevsky',
        id: "afa5de04-344d-11e9-a414-719c6709cf3e",
        genres: ['classic', 'revolution']
    },
]

/*
  you can remove the placeholder query once your first one has been implemented 
*/

const typeDefs = `

    type Mutation {
        addBook(
            title: String!
            author: String!
            published: Int!
            genres: [String!]!
        ): Book
        editAuthor(
            name: String!
            setBornTo: Int
        ): Author
    }
    type Author {
        name: String!
        id: ID!
        born: Int
        bookCount: Int!
    }

    type Book {
        title: String!,
        published: Int!,
        author: Author!,
        id: ID!,
        genres: [String!]!
    }

    type Query {
        bookCount: Int!
        authorCount: Int!
        allBooks(author: String, genre: String): [Book!]!
        allAuthors: [Author!]!
    }
`

const resolvers = {
    Query: {
        bookCount: () => Book.collection.countDocuments(),
        authorCount: () => Author.collection.countDocuments(),
        allBooks: (root, args) => {
            console.log('allBooks.args', args)

            // if no author or genres given in the arguments
            if (!args.author && !args.genre) {
                console.log('no author and generes given')
                return books
            }

            let booklist = books


            // if author is given search for matches
            if (args.author) {
                booklist = booklist.filter(book => book.author === args.author)
            }

            // if genre is given search for matches in genres array
            if (args.genre) {
                booklist = booklist.filter(book => book.genres.includes(args.genre))
            }

            console.log('booklist', booklist)

            return booklist

        },
        allAuthors: () => {
            return authors
        }
    },
    Author: {
        bookCount: (author) => books.filter(book => book.author === author.name).length
    },
    Mutation: {
        addBook: async (root, args) => {

            let author = await Author.findOne({ name: args.author })

            // if author doesn't exist, create a new one
            if (!author) {
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
            return book.populate('author')
        },
        editAuthor: async (root, args) => {

            const author = await Author.findOne({ name: args.name })
            author.born = args.born

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

            // console.log('editAuthor.args', args)
            // const author = authors.find(p => p.name === args.name)
            // console.log('editAuthor.author', author)
            // if (!author) {
            //     return null
            // }

            // const updatedAuthor = { ...author, born: args.setBornTo }
            // authors = authors.map(p => p.name === args.name ? updatedAuthor : p)
            // return updatedAuthor
        }
    }
}

const server = new ApolloServer({
    typeDefs,
    resolvers,
})

startStandaloneServer(server, {
    listen: { port: 4000 },
}).then(({ url }) => {
    console.log(`Server ready at ${url}`)
})