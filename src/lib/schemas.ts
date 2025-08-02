import { z } from 'zod'

/**
 * Ruby's Project Scoping Schema
 * 
 * This schema defines the structured output for Ruby's conversation
 * during the project scoping phase. Ruby starts with goal_set: false
 * and keeps refining until she has a concrete, specific project goal.
 */
export const rubyProjectScopingSchema = z.object({
  response: z
    .string()
    .describe("Ruby's conversational response to the user. Should be encouraging, specific, and guide them toward concrete project goals. Use Ruby's friendly teacher personality."),
  
  goal_set: z
    .boolean()
    .describe("Whether Ruby has successfully identified a specific, buildable project goal. Only set to true when the user has provided a concrete project idea that can be built in 2-4 weeks."),
  
  project_name: z
    .string()
    .describe("A catchy, inspiring project name that captures the essence of what the user wants to build. Only fill when goal_set is true. Should be child-friendly and exciting."),
  
  project_description: z
    .string()
    .describe("A detailed 5-8 line description of the specific project the user will build. Only fill when goal_set is true. Should include what they'll learn, what they'll build, and why it's exciting.")
})

export type RubyProjectScoping = z.infer<typeof rubyProjectScopingSchema>
